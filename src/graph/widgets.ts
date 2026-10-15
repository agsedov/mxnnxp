import { Fraction } from '../math/fraction'
import { Matrix, MatrixDimensionError } from '../math/matrix'
import type { GraphNode, MatrixNodeData, NodeEvaluation } from './types'

export interface PortSpec {
  id: string
  label: string
}

/** Static description of a widget kind: slots and presentation. */
export interface WidgetSpec {
  kind: GraphNode['kind']
  label: string
  inputs: PortSpec[]
  outputs: PortSpec[]
}

export const WIDGET_SPECS: Record<GraphNode['kind'], WidgetSpec> = {
  matrix: {
    kind: 'matrix',
    label: 'Matrix',
    inputs: [],
    outputs: [{ id: 'm', label: 'matrix' }],
  },
  matrixMultiply: {
    kind: 'matrixMultiply',
    label: 'Matrix multiply',
    inputs: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
    outputs: [{ id: 'product', label: 'A × B' }],
  },
}

/** Default content for a new matrix widget: the 2×2 identity. */
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

/**
 * Pure evaluation of a single widget.
 *
 * `inputs` maps input port ids to upstream matrices (null when the upstream
 * slot has no value). Missing values are not errors — widgets simply produce
 * no output until their inputs arrive.
 */
export function evaluateNode(node: GraphNode, inputs: Record<string, Matrix | null>): NodeEvaluation {
  switch (node.kind) {
    case 'matrix':
      return evaluateMatrix(node.data)
    case 'matrixMultiply': {
      const a = inputs.a ?? null
      const b = inputs.b ?? null
      if (!a || !b) {
        return { outputs: { product: null }, error: null }
      }
      try {
        return { outputs: { product: Matrix.multiply(a, b) }, error: null }
      } catch (error) {
        if (error instanceof MatrixDimensionError) {
          return {
            outputs: { product: null },
            error: `Dimension mismatch: ${a.rows}×${a.cols} times ${b.rows}×${b.cols}`,
          }
        }
        throw error
      }
    }
  }
}

function evaluateMatrix(data: MatrixNodeData): NodeEvaluation {
  const cells: Fraction[][] = []
  for (let row = 0; row < data.rows; row++) {
    const values: Fraction[] = []
    for (let col = 0; col < data.cols; col++) {
      const value = Fraction.tryParse(data.cells[row]?.[col] ?? '')
      if (!value) {
        return { outputs: { m: null }, error: `Row ${row + 1}, column ${col + 1}: not a valid fraction` }
      }
      values.push(value)
    }
    cells.push(values)
  }
  return { outputs: { m: Matrix.fromRows(cells) }, error: null }
}
