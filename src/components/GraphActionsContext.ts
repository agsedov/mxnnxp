import { createContext } from 'react'
import type { MatrixNodeData, NodeId } from '../graph/types'

/** Mutations widgets can request without knowing about the graph state. */
export interface GraphActions {
  updateMatrix: (id: NodeId, data: MatrixNodeData) => void
  removeNode: (id: NodeId) => void
}

export const GraphActionsContext = createContext<GraphActions>({
  updateMatrix: () => {},
  removeNode: () => {},
})
