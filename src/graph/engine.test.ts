import { describe, expect, it } from 'vitest'
import {
  addNode,
  connect,
  createGraph,
  evaluateGraph,
  removeNode,
} from './engine'
import { defaultMatrixData } from './widgets'
import type { Graph, MatrixNodeData } from './types'

function withCells(cells: string[][]): MatrixNodeData {
  return { rows: cells.length, cols: cells[0].length, cells }
}

function findMatrix(graph: Graph, index: number) {
  return graph.nodes.filter(node => node.kind === 'matrix')[index]
}

function setMatrixCells(graph: Graph, id: string, cells: string[][]): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map(node =>
      node.id === id && node.kind === 'matrix' ? { ...node, data: withCells(cells) } : node,
    ),
  }
}

describe('addNode', () => {
  it('creates a matrix widget with the 2×2 identity by default', () => {
    const graph = addNode(createGraph(), 'matrix', 10, 20)
    const node = graph.nodes[0]
    expect(node.kind).toBe('matrix')
    expect(node.x).toBe(10)
    expect(node.y).toBe(20)
    if (node.kind !== 'matrix') throw new Error('expected a matrix widget')
    expect(node.data).toEqual(defaultMatrixData())
  })
})

describe('connect', () => {
  it('replaces an existing connection into the same input slot', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrix', 0, 100)
    graph = addNode(graph, 'matrixMultiply', 200, 50)
    const [a, b, multiply] = graph.nodes

    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'a' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'a' })

    expect(graph.connections).toHaveLength(1)
    expect(graph.connections[0].from.node).toBe(b.id)
  })

  it('rejects unknown slots and self-connections', () => {
    let graph = addNode(createGraph(), 'matrixMultiply', 0, 0)
    const multiply = graph.nodes[0]
    expect(() => connect(graph, { node: multiply.id, port: 'nope' }, { node: multiply.id, port: 'a' })).toThrow()
    expect(() => connect(graph, { node: multiply.id, port: 'product' }, { node: multiply.id, port: 'a' })).toThrow()
  })
})

describe('removeNode', () => {
  it('drops attached connections', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrixMultiply', 200, 0)
    const [matrix, multiply] = graph.nodes
    graph = connect(graph, { node: matrix.id, port: 'm' }, { node: multiply.id, port: 'a' })

    const next = removeNode(graph, matrix.id)
    expect(next.nodes).toHaveLength(1)
    expect(next.connections).toHaveLength(0)
  })
})

describe('evaluateGraph', () => {
  it('evaluates a single matrix widget', () => {
    let graph = addNode(createGraph(), 'matrix', 0, 0)
    const matrix = findMatrix(graph, 0)
    graph = setMatrixCells(graph, matrix.id, [['1/2', '0'], ['0', '1/3']])

    const evaluation = evaluateGraph(graph)
    const result = evaluation.get(matrix.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.m?.toString()).toBe('[1/2, 0] [0, 1/3]')
  })

  it('reports invalid cells with their position', () => {
    let graph = addNode(createGraph(), 'matrix', 0, 0)
    const matrix = findMatrix(graph, 0)
    graph = setMatrixCells(graph, matrix.id, [['1', '2'], ['x', '4']])

    const result = evaluateGraph(graph).get(matrix.id)
    expect(result?.outputs.m).toBeNull()
    expect(result?.error).toBe('Row 2, column 1: not a valid fraction')
  })

  it('multiplies two matrices exactly', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrix', 0, 100)
    graph = addNode(graph, 'matrixMultiply', 200, 50)
    const [a, b, multiply] = graph.nodes
    graph = setMatrixCells(graph, a.id, [['1/2', '1/2'], ['0', '1']])
    graph = setMatrixCells(graph, b.id, [['1/3', '0'], ['0', '2/3']])
    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'a' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'b' })

    const result = evaluateGraph(graph).get(multiply.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.product?.toString()).toBe('[1/6, 1/3] [0, 2/3]')
  })

  it('surfaces dimension mismatches on the multiply widget', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrix', 0, 100)
    graph = addNode(graph, 'matrixMultiply', 200, 50)
    const [a, b, multiply] = graph.nodes
    graph = setMatrixCells(graph, a.id, [['1', '2', '3']])
    graph = setMatrixCells(graph, b.id, [['1', '2']])
    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'a' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'b' })

    const result = evaluateGraph(graph).get(multiply.id)
    expect(result?.outputs.product).toBeNull()
    expect(result?.error).toContain('Dimension mismatch')
  })

  it('waits quietly while inputs are unconnected', () => {
    const graph = addNode(createGraph(), 'matrixMultiply', 0, 0)
    const multiply = graph.nodes[0]
    const result = evaluateGraph(graph).get(multiply.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.product).toBeNull()
  })

  it('flags cycles', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrixMultiply', 0, 0)
    graph = addNode(graph, 'matrixMultiply', 200, 0)
    const [first, second] = graph.nodes
    graph = connect(graph, { node: first.id, port: 'product' }, { node: second.id, port: 'a' })
    graph = connect(graph, { node: second.id, port: 'product' }, { node: first.id, port: 'a' })

    const evaluation = evaluateGraph(graph)
    expect(evaluation.get(first.id)?.error).toBe('Cycle detected')
    expect(evaluation.get(second.id)?.error).toBe('Cycle detected')
  })
})
