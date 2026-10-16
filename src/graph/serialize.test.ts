import { describe, expect, it } from 'vitest'
import {
  addNode,
  connect,
  createGraph,
  evaluateGraph,
  updateMatrixData,
  updateRotationData,
  updateScalarData,
  updateVectorCanvasData,
} from './engine'
import { deserializeGraph, GraphSerializationError, serializeGraph, tryDeserializeGraph } from './serialize'
import type { Graph } from './types'

/** A graph using every widget kind, with real content, positions and wiring. */
function sampleGraph(): Graph {
  let graph = createGraph()
  graph = addNode(graph, 'rotation', 700, 96)
  graph = addNode(graph, 'matrix', 40, 96)
  graph = addNode(graph, 'matrix', 40, 300)
  graph = addNode(graph, 'matrix', 40, 520) // driven: its input slot is wired
  graph = addNode(graph, 'matrixMultiply', 430, 96)
  graph = addNode(graph, 'scalar', 120, 700)
  graph = addNode(graph, 'scalarMultiply', 360, 700)
  graph = addNode(graph, 'vectorCanvas', 780, 300)
  const [rotation, a, b, driven, multiply, scalar, scalarMultiply, canvas] = graph.nodes

  // '√2' is unicode *and* parses, so this proves UTF-8 survives the round trip.
  graph = updateMatrixData(graph, a.id, { rows: 2, cols: 2, cells: [['√2', '0'], ['0', '√2']] })
  graph = updateMatrixData(graph, b.id, { rows: 2, cols: 2, cells: [['1', '2'], ['3', '4']] })
  graph = updateScalarData(graph, scalar.id, '1/3')
  graph = updateVectorCanvasData(graph, canvas.id, { mode: 'rows' })
  graph = updateRotationData(graph, rotation.id, { angle: 'pi/6' })

  graph = connect(graph, { node: rotation.id, port: 'm' }, { node: driven.id, port: 'in' })
  graph = connect(graph, { node: rotation.id, port: 'm' }, { node: canvas.id, port: 'm' })
  graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'left' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'right' })
  graph = connect(graph, { node: a.id, port: 'm' }, { node: scalarMultiply.id, port: 'matrix' })
  graph = connect(graph, { node: scalar.id, port: 's' }, { node: scalarMultiply.id, port: 'scalar' })
  return graph
}

function output(matrix: { toString(): string } | null): string | null {
  return matrix ? matrix.toString() : null
}

/** Every widget's outputs as plain strings, for comparing two graphs' behaviour. */
function evaluationSnapshot(graph: Graph): Record<string, Record<string, string | null>> {
  const snapshot: Record<string, Record<string, string | null>> = {}
  for (const [id, result] of evaluateGraph(graph)) {
    snapshot[id] = Object.fromEntries(Object.entries(result.outputs).map(([port, value]) => [port, output(value)]))
  }
  return snapshot
}

/** base64url-encodes ASCII text; lets the tests hand-build payloads directly. */
function encodeText(text: string): string {
  return btoa(text).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function encode(value: unknown): string {
  return encodeText(JSON.stringify(value))
}

/** A well-formed envelope around a widget/wire fragment, for malformed-payload tests. */
function payload(nodes: unknown[], connections: unknown[] = []): string {
  return encode({ v: 1, nodes, connections })
}

const VALID_MATRIX = { id: 'a', kind: 'matrix', x: 10, y: 20, data: { rows: 1, cols: 1, cells: [['1']] } }

describe('serializeGraph', () => {
  it('round-trips every widget, its content, position and wiring', () => {
    const graph = sampleGraph()
    expect(deserializeGraph(serializeGraph(graph))).toEqual(graph)
  })

  it('round-trips an empty canvas', () => {
    expect(deserializeGraph(serializeGraph(createGraph()))).toEqual(createGraph())
  })

  it('is deterministic', () => {
    const graph = sampleGraph()
    expect(serializeGraph(graph)).toBe(serializeGraph(graph))
  })

  it('emits URL-safe text that needs no escaping', () => {
    const encoded = serializeGraph(sampleGraph())
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(encoded)).toBe(encoded)
  })

  it('restores the same values when the decoded graph is evaluated', () => {
    const graph = sampleGraph()
    const restored = deserializeGraph(serializeGraph(graph))

    expect(evaluationSnapshot(restored)).toEqual(evaluationSnapshot(graph))

    const [rotation, a, , , multiply] = graph.nodes
    const values = evaluateGraph(restored)
    expect(output(values.get(multiply.id)?.outputs.product ?? null)).toBe(
      '[sqrt(2), 2*sqrt(2)] [3*sqrt(2), 4*sqrt(2)]',
    )
    expect(output(values.get(a.id)?.outputs.m ?? null)).toBe('[sqrt(2), 0] [0, sqrt(2)]')
    expect(values.get(rotation.id)?.outputs.m?.toString()).toBe('[sqrt(3)/2, -1/2] [1/2, sqrt(3)/2]')
  })
})

describe('deserializeGraph', () => {
  it('rejects text that is not base64url', () => {
    expect(() => deserializeGraph('not base64url!')).toThrow(GraphSerializationError)
  })

  it('rejects a payload that is not JSON', () => {
    expect(() => deserializeGraph(encodeText('{oops'))).toThrow(GraphSerializationError)
  })

  it('rejects a payload that is not an object', () => {
    expect(() => deserializeGraph(encode([1, 2, 3]))).toThrow(/not an object/)
  })

  it('rejects another format version', () => {
    expect(() => deserializeGraph(encode({ v: 2, nodes: [], connections: [] }))).toThrow(/version/)
  })

  it('rejects an unknown widget kind', () => {
    expect(() => deserializeGraph(payload([{ ...VALID_MATRIX, kind: 'hypercube' }]))).toThrow(/known widget kind/)
  })

  it('rejects duplicate widget ids', () => {
    expect(() => deserializeGraph(payload([VALID_MATRIX, VALID_MATRIX]))).toThrow(/Duplicate widget id/)
  })

  it('rejects a widget whose cells do not match its size', () => {
    const node = { ...VALID_MATRIX, data: { rows: 2, cols: 2, cells: [['1', '0']] } }
    expect(() => deserializeGraph(payload([node]))).toThrow(/expected 2/)
  })

  it('rejects a wire to an unknown widget', () => {
    const wire = { id: 'c1', from: { node: 'a', port: 'm' }, to: { node: 'ghost', port: 'in' } }
    expect(() => deserializeGraph(payload([VALID_MATRIX], [wire]))).toThrow(/unknown widget/)
  })

  it('rejects a wire to a slot the widget does not have', () => {
    const wire = { id: 'c1', from: { node: 'a', port: 'sideways' }, to: { node: 'a', port: 'in' } }
    expect(() => deserializeGraph(payload([VALID_MATRIX], [wire]))).toThrow(/no output slot/)
  })

  it('rejects a widget wired to itself', () => {
    const wire = { id: 'c1', from: { node: 'a', port: 'm' }, to: { node: 'a', port: 'in' } }
    expect(() => deserializeGraph(payload([VALID_MATRIX], [wire]))).toThrow(/itself/)
  })

  it('rejects duplicate connection ids', () => {
    const nodes = [VALID_MATRIX, { ...VALID_MATRIX, id: 'b' }]
    const wire = (from: string, to: string) => ({ id: 'c1', from: { node: from, port: 'm' }, to: { node: to, port: 'in' } })
    expect(() => deserializeGraph(payload(nodes, [wire('a', 'b'), wire('b', 'a')]))).toThrow(/Duplicate connection id/)
  })
})

describe('tryDeserializeGraph', () => {
  it('returns the graph for a valid payload', () => {
    const graph = sampleGraph()
    expect(tryDeserializeGraph(serializeGraph(graph))).toEqual(graph)
  })

  it('returns null instead of throwing', () => {
    expect(tryDeserializeGraph('!!!')).toBeNull()
    expect(tryDeserializeGraph(encode({ v: 99 }))).toBeNull()
  })
})
