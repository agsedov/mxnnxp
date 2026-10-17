import { describe, expect, it } from 'vitest'
import {
  addNode,
  connect,
  createGraph,
  evaluateGraph,
  updateCommentData,
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
  graph = addNode(graph, 'rowEchelon', 430, 480)
  graph = addNode(graph, 'rref', 430, 640)
  graph = addNode(graph, 'inverse', 430, 760)
  graph = addNode(graph, 'transpose', 430, 900)
  graph = addNode(graph, 'comment', 780, 560)
  const [rotation, a, b, driven, multiply, scalar, scalarMultiply, canvas, ref, rref, inverse, transpose, comment] =
    graph.nodes

  // '√2' is unicode *and* parses, so this proves UTF-8 survives the round trip.
  graph = updateMatrixData(graph, a.id, { rows: 2, cols: 2, cells: [['√2', '0'], ['0', '√2']] })
  graph = updateMatrixData(graph, b.id, { rows: 2, cols: 2, cells: [['1', '2'], ['3', '4']] })
  graph = updateScalarData(graph, scalar.id, '1/3')
  graph = updateVectorCanvasData(graph, canvas.id, { mode: 'rows' })
  graph = updateRotationData(graph, rotation.id, { angle: 'pi/6' })
  // Cyrillic *and* inline TeX, so both sides of the bilingual note are exercised.
  graph = updateCommentData(graph, comment.id, { en: 'the norm $\\sqrt{2}$', ru: 'норма $\\sqrt{2}$', width: 300 })

  graph = connect(graph, { node: rotation.id, port: 'm' }, { node: driven.id, port: 'in' })
  graph = connect(graph, { node: rotation.id, port: 'm' }, { node: canvas.id, port: 'm' })
  graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'left' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'right' })
  graph = connect(graph, { node: a.id, port: 'm' }, { node: scalarMultiply.id, port: 'matrix' })
  graph = connect(graph, { node: scalar.id, port: 's' }, { node: scalarMultiply.id, port: 'scalar' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: ref.id, port: 'm' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: rref.id, port: 'm' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: inverse.id, port: 'm' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: transpose.id, port: 'm' })
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

/** base64url-encodes bytes as-is — no deflate pass (the old wire format). */
function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * Deflates bytes and base64url-encodes them — the wire format `serializeGraph`
 * emits — so tests can hand-build payloads without using the codec under test.
 */
async function encodeBytes(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))
  const deflated = new Uint8Array(await new Response(stream).arrayBuffer())
  return base64Url(deflated)
}

function encodeText(text: string): Promise<string> {
  return encodeBytes(new TextEncoder().encode(text))
}

function encode(value: unknown): Promise<string> {
  return encodeText(JSON.stringify(value))
}

/** A well-formed envelope around a widget/wire fragment, for malformed-payload tests. */
function payload(nodes: unknown[], connections: unknown[] = []): Promise<string> {
  return encode({ v: 1, nodes, connections })
}

const VALID_MATRIX = { id: 'a', kind: 'matrix', x: 10, y: 20, data: { rows: 1, cols: 1, cells: [['1']] } }

describe('serializeGraph', () => {
  it('round-trips every widget, its content, position and wiring', async () => {
    const graph = sampleGraph()
    expect(await deserializeGraph(await serializeGraph(graph))).toEqual(graph)
  })

  it('round-trips an empty canvas', async () => {
    expect(await deserializeGraph(await serializeGraph(createGraph()))).toEqual(createGraph())
  })

  it('is deterministic', async () => {
    const graph = sampleGraph()
    expect(await serializeGraph(graph)).toBe(await serializeGraph(graph))
  })

  it('emits URL-safe text that needs no escaping', async () => {
    const encoded = await serializeGraph(sampleGraph())
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(encodeURIComponent(encoded)).toBe(encoded)
  })

  it('packs a graph of many cells far below its plain JSON', async () => {
    const graph = sampleGraph()
    const payload = { v: 1, nodes: graph.nodes, connections: graph.connections }
    const plain = new TextEncoder().encode(JSON.stringify(payload)).length
    // base64url alone costs 4/3, so beating the raw JSON at all proves the
    // deflate pass earns its keep.
    expect((await serializeGraph(graph)).length).toBeLessThan(plain)
  })

  it('restores the same values when the decoded graph is evaluated', async () => {
    const graph = sampleGraph()
    const restored = await deserializeGraph(await serializeGraph(graph))

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
  it('rejects text that is not base64url', async () => {
    await expect(deserializeGraph('not base64url!')).rejects.toThrow(GraphSerializationError)
  })

  it('rejects a payload that is not deflate-compressed', async () => {
    // Plain base64url JSON is the old, uncompressed wire format: not accepted.
    const plain = base64Url(new TextEncoder().encode('{"v":1,"nodes":[],"connections":[]}'))
    await expect(deserializeGraph(plain)).rejects.toThrow(/deflate/)
  })

  it('rejects a payload that is not UTF-8', async () => {
    await expect(deserializeGraph(await encodeBytes(Uint8Array.of(0xff, 0xff)))).rejects.toThrow(/UTF-8/)
  })

  it('rejects a payload that is not JSON', async () => {
    await expect(deserializeGraph(await encodeText('{oops'))).rejects.toThrow(/not valid JSON/)
  })

  it('rejects a payload that is not an object', async () => {
    await expect(deserializeGraph(await encode([1, 2, 3]))).rejects.toThrow(/not an object/)
  })

  it('rejects another format version', async () => {
    await expect(deserializeGraph(await encode({ v: 2, nodes: [], connections: [] }))).rejects.toThrow(/version/)
  })

  it('rejects an unknown widget kind', async () => {
    await expect(deserializeGraph(await payload([{ ...VALID_MATRIX, kind: 'hypercube' }]))).rejects.toThrow(
      /known widget kind/,
    )
  })

  it('rejects duplicate widget ids', async () => {
    await expect(deserializeGraph(await payload([VALID_MATRIX, VALID_MATRIX]))).rejects.toThrow(/Duplicate widget id/)
  })

  it('rejects a widget whose cells do not match its size', async () => {
    const node = { ...VALID_MATRIX, data: { rows: 2, cols: 2, cells: [['1', '0']] } }
    await expect(deserializeGraph(await payload([node]))).rejects.toThrow(/expected 2/)
  })

  it('rejects a wire to an unknown widget', async () => {
    const wire = { id: 'c1', from: { node: 'a', port: 'm' }, to: { node: 'ghost', port: 'in' } }
    await expect(deserializeGraph(await payload([VALID_MATRIX], [wire]))).rejects.toThrow(/unknown widget/)
  })

  it('rejects a wire to a slot the widget does not have', async () => {
    const wire = { id: 'c1', from: { node: 'a', port: 'sideways' }, to: { node: 'a', port: 'in' } }
    await expect(deserializeGraph(await payload([VALID_MATRIX], [wire]))).rejects.toThrow(/no output slot/)
  })

  it('rejects a widget wired to itself', async () => {
    const wire = { id: 'c1', from: { node: 'a', port: 'm' }, to: { node: 'a', port: 'in' } }
    await expect(deserializeGraph(await payload([VALID_MATRIX], [wire]))).rejects.toThrow(/itself/)
  })

  it('rejects duplicate connection ids', async () => {
    const nodes = [VALID_MATRIX, { ...VALID_MATRIX, id: 'b' }]
    const wire = (from: string, to: string) => ({ id: 'c1', from: { node: from, port: 'm' }, to: { node: to, port: 'in' } })
    await expect(deserializeGraph(await payload(nodes, [wire('a', 'b'), wire('b', 'a')]))).rejects.toThrow(
      /Duplicate connection id/,
    )
  })

  it('reads a comment side that is missing as empty text', async () => {
    const node = { id: 'c', kind: 'comment', x: 0, y: 0, data: { en: 'note' } }
    const graph = await deserializeGraph(await payload([node]))
    expect(graph.nodes[0].kind === 'comment' ? graph.nodes[0].data : null).toEqual({ en: 'note', ru: '' })
  })

  it('round-trips a comment width, and leaves it absent when the payload has none', async () => {
    const sized = { id: 'c', kind: 'comment', x: 0, y: 0, data: { en: 'a', ru: 'б', width: 420 } }
    const sizedGraph = await deserializeGraph(await payload([sized]))
    expect(sizedGraph.nodes[0].kind === 'comment' ? sizedGraph.nodes[0].data.width : null).toBe(420)

    const unsized = { id: 'c', kind: 'comment', x: 0, y: 0, data: { en: 'a', ru: 'б' } }
    const unsizedGraph = await deserializeGraph(await payload([unsized]))
    expect(unsizedGraph.nodes[0].kind === 'comment' ? unsizedGraph.nodes[0].data.width : 'missing').toBeUndefined()
  })

  it('rejects a comment side that is not a string', async () => {
    const node = { id: 'c', kind: 'comment', x: 0, y: 0, data: { en: 5, ru: '' } }
    await expect(deserializeGraph(await payload([node]))).rejects.toThrow(/data.en is not a string/)
  })

  it('rejects a comment width that is not a number', async () => {
    const node = { id: 'c', kind: 'comment', x: 0, y: 0, data: { en: '', ru: '', width: 'wide' } }
    await expect(deserializeGraph(await payload([node]))).rejects.toThrow(/data.width is not a finite number/)
  })
})

describe('tryDeserializeGraph', () => {
  it('returns the graph for a valid payload', async () => {
    const graph = sampleGraph()
    expect(await tryDeserializeGraph(await serializeGraph(graph))).toEqual(graph)
  })

  it('returns null instead of throwing', async () => {
    expect(await tryDeserializeGraph('!!!')).toBeNull()
    expect(await tryDeserializeGraph(await encode({ v: 99 }))).toBeNull()
  })
})
