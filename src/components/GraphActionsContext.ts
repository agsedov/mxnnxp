import { createContext } from 'react'
import type { MatrixNodeData, NodeId, VectorCanvasNodeData } from '../graph/types'

/** Mutations widgets can request without knowing about the graph state. */
export interface GraphActions {
  updateMatrix: (id: NodeId, data: MatrixNodeData) => void
  updateScalar: (id: NodeId, value: string) => void
  updateVectorCanvas: (id: NodeId, data: VectorCanvasNodeData) => void
  removeNode: (id: NodeId) => void
}

export const GraphActionsContext = createContext<GraphActions>({
  updateMatrix: () => {},
  updateScalar: () => {},
  updateVectorCanvas: () => {},
  removeNode: () => {},
})
