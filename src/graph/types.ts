import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'

export type NodeId = string
export type WidgetKind = 'matrix' | 'matrixMultiply'
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

export type GraphNode = MatrixWidget | MatrixMultiplyWidget

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

export interface NodeEvaluation {
  /** Values produced on the widget's output slots (null = no value right now). */
  outputs: Record<string, Matrix<Algebraic> | null>
  /** Human-readable error, if the widget is in an error state. */
  error: string | null
}

/** Evaluation result per widget. */
export type Evaluation = Map<NodeId, NodeEvaluation>
