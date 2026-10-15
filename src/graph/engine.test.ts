import { describe, expect, it } from 'vitest'
import {
  addNode,
  connect,
  createGraph,
  disconnect,
  evaluateGraph,
  removeNode,
  updateMatrixData,
} from './engine'
import { MATRIX_INPUT_PORT, defaultMatrixData } from './widgets'
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

    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'left' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'left' })

    expect(graph.connections).toHaveLength(1)
    expect(graph.connections[0].from.node).toBe(b.id)
  })

  it('rejects unknown slots and self-connections', () => {
    let graph = addNode(createGraph(), 'matrixMultiply', 0, 0)
    const multiply = graph.nodes[0]
    expect(() => connect(graph, { node: multiply.id, port: 'nope' }, { node: multiply.id, port: 'left' })).toThrow()
    expect(() => connect(graph, { node: multiply.id, port: 'product' }, { node: multiply.id, port: 'left' })).toThrow()
  })
})

describe('removeNode', () => {
  it('drops attached connections', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrixMultiply', 200, 0)
    const [matrix, multiply] = graph.nodes
    graph = connect(graph, { node: matrix.id, port: 'm' }, { node: multiply.id, port: 'left' })

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
    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'left' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'right' })

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
    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'left' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'right' })

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
    graph = connect(graph, { node: first.id, port: 'product' }, { node: second.id, port: 'left' })
    graph = connect(graph, { node: second.id, port: 'product' }, { node: first.id, port: 'left' })

    const evaluation = evaluateGraph(graph)
    expect(evaluation.get(first.id)?.error).toBe('Cycle detected')
    expect(evaluation.get(second.id)?.error).toBe('Cycle detected')
  })
})

describe('matrix widget input slot', () => {
  /** An upstream 2×2 matrix feeding a 1×1 matrix through its input slot. */
  function drivenScene() {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrix', 0, 200)
    const [upstream, driven] = graph.nodes
    graph = setMatrixCells(graph, upstream.id, [['1/2', '0'], ['0', '1']])
    graph = setMatrixCells(graph, driven.id, [['9']])
    graph = connect(graph, { node: upstream.id, port: 'm' }, { node: driven.id, port: MATRIX_INPUT_PORT })
    return { graph, upstream, driven }
  }

  it('passes the incoming matrix through instead of its own cells', () => {
    const { graph, driven } = drivenScene()
    const result = evaluateGraph(graph).get(driven.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.m?.toString()).toBe('[1/2, 0] [0, 1]')
  })

  it('takes the shape of the incoming matrix', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrix', 0, 200)
    const [upstream, driven] = graph.nodes
    graph = setMatrixCells(graph, upstream.id, [['1', '2', '3']])
    graph = connect(graph, { node: upstream.id, port: 'm' }, { node: driven.id, port: MATRIX_INPUT_PORT })

    const matrix = evaluateGraph(graph).get(driven.id)?.outputs.m
    expect(matrix?.rows).toBe(1)
    expect(matrix?.cols).toBe(3)
  })

  it('ignores its own cells, even invalid ones, while driven', () => {
    const { graph, driven } = drivenScene()
    const broken = setMatrixCells(graph, driven.id, [['nonsense']])
    const result = evaluateGraph(broken).get(driven.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.m?.toString()).toBe('[1/2, 0] [0, 1]')
  })

  it('waits quietly while the upstream slot has no value', () => {
    const { graph, upstream, driven } = drivenScene()
    const evaluation = evaluateGraph(setMatrixCells(graph, upstream.id, [['oops']]))

    expect(evaluation.get(upstream.id)?.error).toContain('not a valid fraction')
    expect(evaluation.get(driven.id)?.error).toBeNull()
    expect(evaluation.get(driven.id)?.outputs.m).toBeNull()
  })

  it('feeds a multiply widget with the incoming matrix', () => {
    // upstream (2×2) → driven (own cells are a 1×1 "9") → product = upstream × identity.
    let graph = drivenScene().graph
    graph = addNode(graph, 'matrix', 0, 400)
    graph = addNode(graph, 'matrixMultiply', 400, 100)
    const [, driven, factor, multiply] = graph.nodes
    graph = setMatrixCells(graph, factor.id, [['1', '0'], ['0', '1']])
    graph = connect(graph, { node: driven.id, port: 'm' }, { node: multiply.id, port: 'left' })
    graph = connect(graph, { node: factor.id, port: 'm' }, { node: multiply.id, port: 'right' })

    // Passing its own 1×1 cell along would be a dimension mismatch instead.
    expect(evaluateGraph(graph).get(multiply.id)?.outputs.product?.toString()).toBe('[1/2, 0] [0, 1]')
  })

  it('is read-only while driven and editable again once the wire is removed', () => {
    const { graph, driven } = drivenScene()
    const attempt = updateMatrixData(graph, driven.id, { rows: 1, cols: 1, cells: [['42']] })
    expect(attempt).toBe(graph)

    const freed = disconnect(graph, graph.connections[0].id)
    const updated = updateMatrixData(freed, driven.id, { rows: 1, cols: 1, cells: [['42']] })
    const node = updated.nodes.find(candidate => candidate.id === driven.id)
    expect(node?.kind === 'matrix' ? node.data.cells[0][0] : null).toBe('42')
  })
})
