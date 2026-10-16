import { parseExact, COS_SIN_TABLE, type Algebraic } from '../math/exact'
import { Matrix, MatrixDimensionError } from '../math/matrix'
import type { GraphNode, MatrixNodeData, NodeEvaluation, RotationNodeData, VectorCanvasMode, VectorCanvasNodeData } from './types'
import { fitsVectorMode, vectorComponents, vectorCount } from './vectorCanvas'

export interface PortSpec {
  id: string
}

/**
 * Static description of a widget kind: its slots. Presentation (the title and
 * slot labels, in the active language) lives in the UI — see
 * `src/i18n/labels.ts`.
 */
export interface WidgetSpec {
  kind: GraphNode['kind']
  inputs: PortSpec[]
  outputs: PortSpec[]
}

/**
 * Input slot of the matrix widget. While something is connected here, the widget
 * is *driven*: it displays — and passes on — the incoming matrix instead of its
 * own editable values.
 */
export const MATRIX_INPUT_PORT = 'in'

export const WIDGET_SPECS: Record<GraphNode['kind'], WidgetSpec> = {
  matrix: {
    kind: 'matrix',
    inputs: [{ id: MATRIX_INPUT_PORT }],
    outputs: [{ id: 'm' }],
  },
  matrixMultiply: {
    kind: 'matrixMultiply',
    inputs: [{ id: 'left' }, { id: 'right' }],
    outputs: [{ id: 'product' }],
  },
  scalar: {
    kind: 'scalar',
    inputs: [],
    outputs: [{ id: 's' }],
  },
  scalarMultiply: {
    kind: 'scalarMultiply',
    inputs: [{ id: 'matrix' }, { id: 'scalar' }],
    outputs: [{ id: 'product' }],
  },
  vectorCanvas: {
    kind: 'vectorCanvas',
    inputs: [{ id: 'm' }],
    outputs: [],
  },
  rotation: {
    kind: 'rotation',
    inputs: [],
    outputs: [{ id: 'm' }],
  },
}

export function defaultMatrixData(): MatrixNodeData {
  return {
    rows: 2,
    cols: 2,
    cells: [
      ['1', '0'],
      ['0', '1'],
    ],
  }
}

export function defaultScalarData(): { value: string } {
  return { value: '1' }
}

export function defaultVectorCanvasData(): VectorCanvasNodeData {
  return { mode: 'rows' }
}

export function defaultRotationData(): RotationNodeData {
  return { angle: '0' }
}

/**
 * Pure evaluation of a single widget.
 *
 * `inputs` maps input port ids to upstream matrices (null when the upstream
 * slot has no value), `connectedInputs` names the slots that actually carry a
 * connection. Missing values are not errors — widgets simply produce no output
 * until their inputs arrive.
 */
export function evaluateNode(
  node: GraphNode,
  inputs: Record<string, Matrix<Algebraic> | null>,
  connectedInputs: ReadonlySet<string>,
): NodeEvaluation {
  switch (node.kind) {
    case 'matrix':
      return evaluateMatrix(
        node.data,
        inputs[MATRIX_INPUT_PORT] ?? null,
        connectedInputs.has(MATRIX_INPUT_PORT),
      )
    case 'scalar':
      return evaluateScalar(node.data)
    case 'rotation':
      return evaluateRotation(node.data)
    case 'vectorCanvas':
      return evaluateVectorCanvas(inputs.m ?? null, node.data.mode)
    case 'matrixMultiply': {
      const left = inputs.left ?? null
      const right = inputs.right ?? null
      if (!left || !right) {
        return { outputs: { product: null }, error: null }
      }
      try {
        return { outputs: { product: Matrix.multiply(left, right) }, error: null }
      } catch (error) {
        if (error instanceof MatrixDimensionError) {
          return {
            outputs: { product: null },
            error: {
              code: 'dimension',
              leftRows: left.rows,
              leftCols: left.cols,
              rightRows: right.rows,
              rightCols: right.cols,
            },
          }
        }
        throw error
      }
    }
    case 'scalarMultiply': {
      const matrix = inputs.matrix ?? null
      const scalar = inputs.scalar ?? null
      if (!matrix || !scalar) {
        return { outputs: { product: null }, error: null }
      }
      const s = scalar.get(0, 0)
      const data = Array.from({ length: matrix.rows }, (_, i) =>
        Array.from({ length: matrix.cols }, (_, j) => matrix.get(i, j).mul(s)),
      )
      return { outputs: { product: Matrix.fromRows(data) }, error: null }
    }
  }
}

/**
 * A matrix widget either produces its own values, or — while its input slot is
 * connected — is driven: it passes the incoming matrix through unchanged and
 * ignores its own cells (read-only). Without an incoming value it waits.
 */
function evaluateMatrix(
  data: MatrixNodeData,
  incoming: Matrix<Algebraic> | null,
  driven: boolean,
): NodeEvaluation {
  if (driven) {
    return { outputs: { m: incoming }, error: null }
  }
  const cells: Algebraic[][] = []
  for (let row = 0; row < data.rows; row++) {
    const values: Algebraic[] = []
    for (let col = 0; col < data.cols; col++) {
      try {
        values.push(parseExact(data.cells[row]?.[col] ?? ''))
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return { outputs: { m: null }, error: { code: 'cell', row: row + 1, col: col + 1, reason } }
      }
    }
    cells.push(values)
  }
  return { outputs: { m: Matrix.fromRows(cells) }, error: null }
}

function evaluateScalar(data: { value: string }): NodeEvaluation {
  try {
    const scalar = parseExact(data.value ?? '0')
    const cells: Algebraic[][] = [[scalar]]
    return { outputs: { s: Matrix.fromRows(cells) }, error: null }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { outputs: { s: null }, error: { code: 'cell', row: 1, col: 1, reason } }
  }
}

/** A 2D rotation source: an exact `[[cos, -sin], [sin, cos]]` matrix. */
function evaluateRotation(data: RotationNodeData): NodeEvaluation {
  const [cos, sin] = COS_SIN_TABLE[data.angle] ?? COS_SIN_TABLE['0']
  return { outputs: { m: Matrix.fromRows([[cos, sin.neg()], [sin, cos]]) }, error: null }
}

function evaluateVectorCanvas(matrix: Matrix<Algebraic> | null, mode: VectorCanvasMode): NodeEvaluation {
  if (!matrix) {
    return { outputs: {}, error: null }
  }
  if (!fitsVectorMode(matrix, mode)) {
    return { outputs: {}, error: { code: 'vectorShape', rows: matrix.rows, cols: matrix.cols, mode } }
  }
  // The canvas draws a real 2D plane, so a complex component has no place on it.
  for (let index = 0; index < vectorCount(matrix, mode); index++) {
    const [x, y] = vectorComponents(matrix, mode, index)
    if (!x.isReal()) return { outputs: {}, error: { code: 'complex', ...componentCell(mode, index, 0) } }
    if (!y.isReal()) return { outputs: {}, error: { code: 'complex', ...componentCell(mode, index, 1) } }
  }
  return { outputs: {}, error: null }
}

/** Cell position of a vector component, following the mode's orientation. */
function componentCell(mode: VectorCanvasMode, index: number, component: 0 | 1): { row: number; col: number } {
  return mode === 'rows' ? { row: index + 1, col: component + 1 } : { row: component + 1, col: index + 1 }
}
