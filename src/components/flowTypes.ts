import type { Node } from '@xyflow/react'
import type { GraphNode, NodeEvaluation } from '../graph/types'

/** Payload React Flow carries for every widget node. */
export type FlowNodeData = {
  source: GraphNode
  evaluation: NodeEvaluation | null
  connectedInputs: string[]
  connectedOutputs: string[]
}

export type FlowNode = Node<FlowNodeData>
