import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'

export type NodeId = string
export type WidgetKind = 'matrix' | 'matrixMultiply' | 'scalar' | 'scalarMultiply' | 'vectorCanvas'
export type PortDirection = 'input' | 'output'

/** A reference to a slot ("port") on a widget. */
export interface PortRef {
  node: NodeId
  port: string
}

export interface MatrixNodeData {
  rows: number
  cols: number
  /** Raw text per cell; parsed to exact numbers at evaluation time (see `parseExact`). */
  cells: string[][]
}

export interface MatrixWidget {
  id: NodeId
  kind: 'matrix'
  x: number
  y: number
  data: MatrixNodeData
}

export interface MatrixMultiplyWidget {
  id: NodeId
  kind: 'matrixMultiply'
  x: number
  y: number
}

export interface ScalarWidget {
  id: NodeId
  kind: 'scalar'
  x: number
  y: number
  data: { value: string }
}

export interface ScalarMultiplyWidget {
  id: NodeId
  kind: 'scalarMultiply'
  x: number
  y: number
}

export interface VectorCanvasWidget {
  id: NodeId
  kind: 'vectorCanvas'
  x: number
  y: number
  data: { mode: 'rows' | 'cols' }
}

export type GraphNode = MatrixWidget | MatrixMultiplyWidget | ScalarWidget | ScalarMultiplyWidget | VectorCanvasWidget

export interface Connection {
  id: string
  /** Source slot: an output port of some widget. */
  from: PortRef
  /** Destination slot: an input port of some widget. */
  to: PortRef
}

export interface Graph {
  nodes: GraphNode[]
  connections: Connection[]
}

/**
 * A widget error, as structured data rather than a sentence.
 *
 * The engine stays free of presentation and locale: it reports *what* went
 * wrong, and the UI turns that into text (see `describeNodeError`). `reason`
 * carries the raw parser message for diagnostics.
 */
export type NodeError =
  | { readonly code: 'cycle' }
  | {
      readonly code: 'dimension'
      readonly leftRows: number
      readonly leftCols: number
      readonly rightRows: number
      readonly rightCols: number
    }
  | { readonly code: 'cell'; readonly row: number; readonly col: number; readonly reason: string }

export interface NodeEvaluation {
  /** Values produced on the widget's output slots (null = no value right now). */
  outputs: Record<string, Matrix<Algebraic> | null>
  /** Why the widget is in an error state, if it is. */
  error: NodeError | null
}

/** Evaluation result per widget. */
export type Evaluation = Map<NodeId, NodeEvaluation>
