import { createContext } from 'react'
import type { CommentNodeData, MatrixNodeData, NodeId, RotationNodeData, VectorCanvasNodeData } from '../graph/types'

/** Mutations widgets can request without knowing about the graph state. */
export interface GraphActions {
  updateMatrix: (id: NodeId, data: MatrixNodeData) => void
  updateScalar: (id: NodeId, value: string) => void
  updateVectorCanvas: (id: NodeId, data: VectorCanvasNodeData) => void
  updateRotation: (id: NodeId, data: RotationNodeData) => void
  updateComment: (id: NodeId, data: CommentNodeData) => void
  removeNode: (id: NodeId) => void
}

export const GraphActionsContext = createContext<GraphActions>({
  updateMatrix: () => {},
  updateScalar: () => {},
  updateVectorCanvas: () => {},
  updateRotation: () => {},
  updateComment: () => {},
  removeNode: () => {},
})
