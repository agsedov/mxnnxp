import { describe, expect, it } from 'vitest'
import {
  addNode,
  connect,
  createGraph,
  disconnect,
  evaluateGraph,
  removeNode,
  updateMatrixData,
  updateRotationData,
  updateVectorCanvasData,
} from './engine'
import { MATRIX_INPUT_PORT, defaultMatrixData, defaultRotationData } from './widgets'
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
    expect(result?.error).toEqual({ code: 'cell', row: 2, col: 1, reason: 'Unknown name "x"' })
  })

  it('evaluates irrational and complex cells exactly', () => {
    let graph = addNode(createGraph(), 'matrix', 0, 0)
    const matrix = findMatrix(graph, 0)
    graph = setMatrixCells(graph, matrix.id, [
      ['sqrt(2)/2', 'i'],
      ['0', '1 - i'],
    ])

    const result = evaluateGraph(graph).get(matrix.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.m?.toString()).toBe('[sqrt(2)/2, i] [0, 1 - i]')
  })

  it('multiplies irrational matrices exactly', () => {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'matrix', 0, 100)
    graph = addNode(graph, 'matrixMultiply', 200, 50)
    const [a, b, multiply] = graph.nodes
    // A rotation by 45°: [[√2/2, -√2/2], [√2/2, √2/2]]. A² is the 90° rotation.
    graph = setMatrixCells(graph, a.id, [
      ['sqrt(2)/2', '-sqrt(2)/2'],
      ['sqrt(2)/2', 'sqrt(2)/2'],
    ])
    graph = setMatrixCells(graph, b.id, [
      ['sqrt(2)/2', '-sqrt(2)/2'],
      ['sqrt(2)/2', 'sqrt(2)/2'],
    ])
    graph = connect(graph, { node: a.id, port: 'm' }, { node: multiply.id, port: 'left' })
    graph = connect(graph, { node: b.id, port: 'm' }, { node: multiply.id, port: 'right' })

    expect(evaluateGraph(graph).get(multiply.id)?.outputs.product?.toString()).toBe('[0, -1] [1, 0]')
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
    expect(result?.error).toEqual({ code: 'dimension', leftRows: 1, leftCols: 3, rightRows: 1, rightCols: 2 })
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
    expect(evaluation.get(first.id)?.error).toEqual({ code: 'cycle' })
    expect(evaluation.get(second.id)?.error).toEqual({ code: 'cycle' })
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

    expect(evaluation.get(upstream.id)?.error).toMatchObject({ code: 'cell', row: 1, col: 1 })
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

describe('vector canvas widget', () => {
  /** A canvas fed by a matrix, with the reading mode set explicitly. */
  function canvasScene(mode: 'rows' | 'cols', cells: string[][]) {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'vectorCanvas', 300, 0)
    const [matrix, canvas] = graph.nodes
    graph = setMatrixCells(graph, matrix.id, cells)
    graph = connect(graph, { node: matrix.id, port: 'm' }, { node: canvas.id, port: 'm' })
    graph = updateVectorCanvasData(graph, canvas.id, { mode })
    return { graph, canvas }
  }

  it('accepts one 2-component vector per row in rows mode', () => {
    const { graph, canvas } = canvasScene('rows', [['1', '0'], ['0', '1'], ['1/2', 'sqrt(2)']])
    const result = evaluateGraph(graph).get(canvas.id)
    expect(result?.error).toBeNull()
    // The widget draws from the value the widget saw on its input slot.
    expect(result?.inputs?.m?.rows).toBe(3)
    expect(result?.inputs?.m?.cols).toBe(2)
  })

  it('rejects a shape that does not fit the mode, naming it', () => {
    const rows = canvasScene('rows', [['1', '2', '3'], ['4', '5', '6']])
    expect(evaluateGraph(rows.graph).get(rows.canvas.id)?.error).toEqual({
      code: 'vectorShape',
      rows: 2,
      cols: 3,
      mode: 'rows',
    })

    const cols = canvasScene('cols', [['1', '2'], ['3', '4'], ['5', '6']])
    expect(evaluateGraph(cols.graph).get(cols.canvas.id)?.error).toEqual({
      code: 'vectorShape',
      rows: 3,
      cols: 2,
      mode: 'cols',
    })
  })

  it('reads the same matrix by the other orientation once the mode changes', () => {
    const { graph, canvas } = canvasScene('rows', [['1', '2', '3'], ['4', '5', '6']])
    expect(evaluateGraph(graph).get(canvas.id)?.error).toMatchObject({ code: 'vectorShape' })

    const flipped = updateVectorCanvasData(graph, canvas.id, { mode: 'cols' })
    expect(evaluateGraph(flipped).get(canvas.id)?.error).toBeNull()
  })

  it('rejects complex components with their cell position', () => {
    const cell = canvasScene('rows', [['1', 'i'], ['0', '1']])
    expect(evaluateGraph(cell.graph).get(cell.canvas.id)?.error).toEqual({ code: 'complex', row: 1, col: 2 })

    const column = canvasScene('cols', [['1', '2'], ['0', '1 - i']])
    expect(evaluateGraph(column.graph).get(column.canvas.id)?.error).toEqual({ code: 'complex', row: 2, col: 2 })
  })

  it('waits quietly while the input carries no value', () => {
    const graph = addNode(createGraph(), 'vectorCanvas', 0, 0)
    const result = evaluateGraph(graph).get(graph.nodes[0].id)
    expect(result?.error).toBeNull()
    expect(result?.inputs?.m).toBeNull()
  })

  it('produces no output value on any slot', () => {
    const { graph, canvas } = canvasScene('rows', [['1', '0'], ['0', '1']])
    expect(evaluateGraph(graph).get(canvas.id)?.outputs).toEqual({})
  })
})

describe('rotation widget', () => {
  /** A rotation source set to one of the basic angles. */
  function rotationScene(angle: string) {
    let graph = addNode(createGraph(), 'rotation', 0, 0)
    const rotation = graph.nodes[0]
    graph = updateRotationData(graph, rotation.id, { angle })
    return { graph, rotation }
  }

  it('starts at angle 0, the identity matrix', () => {
    const graph = addNode(createGraph(), 'rotation', 0, 0)
    const node = graph.nodes[0]
    if (node.kind !== 'rotation') throw new Error('expected a rotation widget')
    expect(node.data).toEqual(defaultRotationData())
    expect(evaluateGraph(graph).get(node.id)?.outputs.m?.toString()).toBe('[1, 0] [0, 1]')
  })

  it('emits the exact rotation matrix for the selected angle', () => {
    const { graph, rotation } = rotationScene('pi/2')
    expect(evaluateGraph(graph).get(rotation.id)?.outputs.m?.toString()).toBe('[0, -1] [1, 0]')
  })

  it('keeps irrational entries exact', () => {
    const { graph, rotation } = rotationScene('pi/6')
    expect(evaluateGraph(graph).get(rotation.id)?.outputs.m?.toString()).toBe(
      '[sqrt(3)/2, -1/2] [1/2, sqrt(3)/2]',
    )
  })

  it('drives a downstream matrix widget', () => {
    let graph = addNode(createGraph(), 'rotation', 0, 0)
    graph = addNode(graph, 'matrix', 200, 0)
    const [rotation, matrix] = graph.nodes
    graph = updateRotationData(graph, rotation.id, { angle: 'pi/3' })
    graph = connect(graph, { node: rotation.id, port: 'm' }, { node: matrix.id, port: MATRIX_INPUT_PORT })

    expect(evaluateGraph(graph).get(matrix.id)?.outputs.m?.toString()).toBe('[1/2, -sqrt(3)/2] [sqrt(3)/2, 1/2]')
  })

  it('falls back to the identity for an unknown angle', () => {
    const { graph, rotation } = rotationScene('tau')
    expect(evaluateGraph(graph).get(rotation.id)?.outputs.m?.toString()).toBe('[1, 0] [0, 1]')
  })
})

describe('row echelon widget', () => {
  /** A matrix widget wired into a row echelon widget. */
  function refScene(cells: string[][]) {
    let graph = createGraph()
    graph = addNode(graph, 'matrix', 0, 0)
    graph = addNode(graph, 'rowEchelon', 200, 0)
    const [matrix, ref] = graph.nodes
    graph = setMatrixCells(graph, matrix.id, cells)
    graph = connect(graph, { node: matrix.id, port: 'm' }, { node: ref.id, port: 'm' })
    return { graph, ref }
  }

  it('emits the row echelon form of the incoming matrix', () => {
    const { graph, ref } = refScene([
      ['1', '2'],
      ['3', '4'],
    ])
    const result = evaluateGraph(graph).get(ref.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.ref?.toString()).toBe('[1, 2] [0, -2]')
  })

  it('swaps rows and keeps pivots unscaled, exactly', () => {
    const { graph, ref } = refScene([
      ['0', '1', '1'],
      ['2', '3', '1'],
      ['4', '5', '1'],
    ])
    // Rows 0↔1 swap in the pivot; 2 stays 2 (not normalized to 1); the last
    // row eliminates to all zeros and sinks to the bottom.
    expect(evaluateGraph(graph).get(ref.id)?.outputs.ref?.toString()).toBe('[2, 3, 1] [0, 1, 1] [0, 0, 0]')
  })

  it('keeps radical entries exact through elimination', () => {
    const { graph, ref } = refScene([
      ['sqrt(2)', '1'],
      ['1', '1'],
    ])
    expect(evaluateGraph(graph).get(ref.id)?.outputs.ref?.toString()).toBe('[sqrt(2), 1] [0, 1 - sqrt(2)/2]')
  })

  it('waits quietly while the input carries no value', () => {
    const graph = addNode(createGraph(), 'rowEchelon', 0, 0)
    const ref = graph.nodes[0]
    const result = evaluateGraph(graph).get(ref.id)
    expect(result?.error).toBeNull()
    expect(result?.outputs.ref).toBeNull()
  })
})
