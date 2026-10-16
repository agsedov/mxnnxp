import { describe, expect, it } from 'vitest'
import type { Edge } from '@xyflow/react'

import { addNode, connect, createGraph, evaluateGraph, updateMatrixData } from '../graph/engine'
import type { Evaluation, Graph } from '../graph/types'
import { reconcileEdges, reconcileNodes } from './flowSync'

function scene(): { graph: Graph; evaluation: Evaluation } {
  let graph = createGraph()
  graph = addNode(graph, 'matrix', 10, 20)
  graph = addNode(graph, 'matrix', 10, 200)
  graph = addNode(graph, 'matrixMultiply', 300, 100)
  const [a, b, product] = graph.nodes
  graph = connect(graph, { node: a.id, port: 'm' }, { node: product.id, port: 'left' })
  graph = connect(graph, { node: b.id, port: 'm' }, { node: product.id, port: 'right' })
  return { graph, evaluation: evaluateGraph(graph) }
}

describe('reconcileNodes', () => {
  it('projects the graph into nodes carrying the widget data', () => {
    const { graph, evaluation } = scene()
    const nodes = reconcileNodes([], graph, evaluation)
    expect(nodes).toHaveLength(3)
    expect(nodes[2].data.connectedInputs).toEqual(['left', 'right'])
    expect(nodes[0].data.connectedOutputs).toEqual(['m'])
    expect(nodes[0].position).toEqual({ x: 10, y: 20 })
  })

  it('returns the exact same array when nothing changed', () => {
    const { graph, evaluation } = scene()
    const nodes = reconcileNodes([], graph, evaluation)
    expect(reconcileNodes(nodes, graph, evaluation)).toBe(nodes)
  })

  it('keeps every untouched node object identical', () => {
    const { graph, evaluation } = scene()
    const nodes = reconcileNodes([], graph, evaluation)
    // Rewriting "1" as "2/2" changes the widget data but not the value it produces,
    // so downstream widgets must be reused untouched.
    const edited = updateMatrixData(graph, graph.nodes[0].id, {
      rows: 2,
      cols: 2,
      cells: [['2/2', '0'], ['0', '1']],
    })
    const next = reconcileNodes(nodes, edited, evaluateGraph(edited))

    expect(next[0]).not.toBe(nodes[0])
    expect(next[1]).toBe(nodes[1])
    expect(next[2]).toBe(nodes[2])
  })

  it('preserves the interaction state React Flow owns when data changes', () => {
    const { graph, evaluation } = scene()
    const nodes = reconcileNodes([], graph, evaluation)
    nodes[0] = { ...nodes[0], position: { x: 999, y: 888 }, measured: { width: 354, height: 242 }, selected: true }

    const edited = updateMatrixData(graph, graph.nodes[0].id, { rows: 1, cols: 1, cells: [['1/2']] })
    const next = reconcileNodes(nodes, edited, evaluateGraph(edited))

    expect(next[0]).not.toBe(nodes[0])
    expect(next[0].position).toEqual({ x: 999, y: 888 })
    expect(next[0].measured).toEqual({ width: 354, height: 242 })
    expect(next[0].selected).toBe(true)
  })

  it('adds new widgets and drops removed ones', () => {
    const { graph, evaluation } = scene()
    const nodes = reconcileNodes([], graph, evaluation)
    const grown = addNode(graph, 'matrixMultiply', 600, 400)
    expect(reconcileNodes(nodes, grown, evaluateGraph(grown))).toHaveLength(4)
  })

  it('repaints a vector canvas when only its incoming value changes', () => {
    // The canvas produces no output of its own: without comparing the values it
    // saw on its input slot it would never redraw.
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'vectorCanvas', 300, 0)
    const [matrix, canvas] = graph.nodes
    graph = connect(graph, { node: matrix.id, port: 'm' }, { node: canvas.id, port: 'm' })
    const nodes = reconcileNodes([], graph, evaluateGraph(graph))

    const edited = updateMatrixData(graph, matrix.id, { rows: 2, cols: 2, cells: [['2', '0'], ['0', '1']] })
    const next = reconcileNodes(nodes, edited, evaluateGraph(edited))

    expect(next[0]).not.toBe(nodes[0])
    expect(next[1]).not.toBe(nodes[1])
  })
})

describe('reconcileEdges', () => {
  it('projects connections into edges', () => {
    const { graph, evaluation } = scene()
    const edges = reconcileEdges([], graph, evaluation)
    expect(edges).toHaveLength(2)
    expect(edges[0]).toMatchObject({
      source: graph.nodes[0].id,
      sourceHandle: 'm',
      target: graph.nodes[2].id,
      targetHandle: 'left',
    })
  })

  it('returns the exact same array when nothing changed', () => {
    const { graph, evaluation } = scene()
    const edges = reconcileEdges([], graph, evaluation)
    expect(reconcileEdges(edges, graph, evaluation)).toBe(edges)
  })

  it('marks the wires feeding a widget in an error state', () => {
    const { graph, evaluation } = scene()
    const edges: Edge[] = reconcileEdges([], graph, evaluation)

    // A is 2×2, so a 3×3 B no longer multiplies with it — the product errors out.
    const broken = updateMatrixData(graph, graph.nodes[1].id, {
      rows: 3,
      cols: 3,
      cells: [
        ['1', '0', '0'],
        ['0', '1', '0'],
        ['0', '0', '1'],
      ],
    })
    const next = reconcileEdges(edges, broken, evaluateGraph(broken))

    expect(next[0]).not.toBe(edges[0])
    expect(next[0].className).toBe('edge-error')
    expect(next[1].className).toBe('edge-error')
  })

  it('adds and removes edges as connections change', () => {
    const { graph, evaluation } = scene()
    const edges = reconcileEdges([], graph, evaluation)
    const fewer: Graph = { ...graph, connections: graph.connections.slice(0, 1) }
    expect(reconcileEdges(edges, fewer, evaluateGraph(fewer))).toHaveLength(1)
  })
})

describe('reconcileEdges error rendering', () => {
  it('keeps edges without errors free of a className', () => {
    const { graph, evaluation } = scene()
    const edges: Edge[] = reconcileEdges([], graph, evaluation)
    expect(edges.every(edge => edge.className === undefined)).toBe(true)
  })
})
