import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'

export type NodeId = string
export type WidgetKind =
  | 'matrix'
  | 'matrixMultiply'
  | 'scalar'
  | 'scalarMultiply'
  | 'vectorCanvas'
  | 'rotation'
  | 'rowEchelon'
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

/**
 * How the vector canvas reads its input matrix: `rows` treats every row as a
 * vector (so the matrix must be m×2), `cols` treats every column as one (2×n).
 */
export type VectorCanvasMode = 'rows' | 'cols'

export interface VectorCanvasNodeData {
  mode: VectorCanvasMode
}

export interface VectorCanvasWidget {
  id: NodeId
  kind: 'vectorCanvas'
  x: number
  y: number
  data: VectorCanvasNodeData
}

/** A 2D rotation source: the angle is a key into `COS_SIN_TABLE` (`'pi/6'`, ...). */
export interface RotationNodeData {
  angle: string
}

export interface RotationWidget {
  id: NodeId
  kind: 'rotation'
  x: number
  y: number
  data: RotationNodeData
}

/** A transform that emits the row echelon form of the matrix on its input. */
export interface RowEchelonWidget {
  id: NodeId
  kind: 'rowEchelon'
  x: number
  y: number
}

export type GraphNode =
  | MatrixWidget
  | MatrixMultiplyWidget
  | ScalarWidget
  | ScalarMultiplyWidget
  | VectorCanvasWidget
  | RotationWidget
  | RowEchelonWidget

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
  | {
      readonly code: 'vectorShape'
      readonly rows: number
      readonly cols: number
      readonly mode: VectorCanvasMode
    }
  | { readonly code: 'complex'; readonly row: number; readonly col: number }

export interface NodeEvaluation {
  /** Values produced on the widget's output slots (null = no value right now). */
  outputs: Record<string, Matrix<Algebraic> | null>
  /** Values arriving on the widget's input slots (null = no value right now). */
  inputs?: Record<string, Matrix<Algebraic> | null>
  /** Why the widget is in an error state, if it is. */
  error: NodeError | null
}

/** Evaluation result per widget. */
export type Evaluation = Map<NodeId, NodeEvaluation>
