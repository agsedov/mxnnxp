import type { Edge } from '@xyflow/react'

import type { Evaluation, Graph, GraphNode, NodeError, NodeEvaluation } from '../graph/types'
import { WIDGET_SPECS } from '../graph/widgets'
import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'
import type { FlowNode, FlowNodeData } from './flowTypes'

/** `nodeId:portId` keys of the slots that currently carry a connection. */
function collectConnectedPorts(graph: Graph): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set<string>()
  const outputs = new Set<string>()
  for (const connection of graph.connections) {
    inputs.add(`${connection.to.node}:${connection.to.port}`)
    outputs.add(`${connection.from.node}:${connection.from.port}`)
  }
  return { inputs, outputs }
}

function buildNodeData(
  node: GraphNode,
  connected: { inputs: Set<string>; outputs: Set<string> },
  evaluation: Evaluation,
): FlowNodeData {
  const spec = WIDGET_SPECS[node.kind]
  return {
    source: node,
    evaluation: evaluation.get(node.id) ?? null,
    connectedInputs: spec.inputs.filter(port => connected.inputs.has(`${node.id}:${port.id}`)).map(port => port.id),
    connectedOutputs: spec.outputs.filter(port => connected.outputs.has(`${node.id}:${port.id}`)).map(port => port.id),
  }
}

function sameStrings(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function matricesEqual(a: Matrix<Algebraic> | null, b: Matrix<Algebraic> | null): boolean {
  if (a === b) return true
  if (!a || !b || a.rows !== b.rows || a.cols !== b.cols) return false
  for (let row = 0; row < a.rows; row++) {
    for (let col = 0; col < a.cols; col++) {
      if (!a.get(row, col).equals(b.get(row, col))) return false
    }
  }
  return true
}

/**
 * Value comparison for errors: the engine rebuilds evaluation objects on every
 * run, so reference equality would make every erroring widget churn.
 */
function nodeErrorsEqual(a: NodeError | null, b: NodeError | null): boolean {
  if (a === b) return true
  if (!a || !b || a.code !== b.code) return false
  switch (a.code) {
    case 'cycle':
      return true
    case 'dimension':
      return (
        b.code === 'dimension' &&
        a.leftRows === b.leftRows &&
        a.leftCols === b.leftCols &&
        a.rightRows === b.rightRows &&
        a.rightCols === b.rightCols
      )
    case 'cell':
      return b.code === 'cell' && a.row === b.row && a.col === b.col && a.reason === b.reason
    case 'vectorShape':
      return b.code === 'vectorShape' && a.rows === b.rows && a.cols === b.cols && a.mode === b.mode
    case 'complex':
      return b.code === 'complex' && a.row === b.row && a.col === b.col
  }
}

/** Value comparison for the input values a widget saw, port by port. */
function inputsEqual(
  a: Record<string, Matrix<Algebraic> | null> | undefined,
  b: Record<string, Matrix<Algebraic> | null> | undefined,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  const ports = Object.keys(a)
  const otherPorts = Object.keys(b)
  return (
    ports.length === otherPorts.length &&
    ports.every(port => matricesEqual(a[port] ?? null, b[port] ?? null))
  )
}

/** Value comparison: the engine rebuilds evaluation objects on every run. */
function evaluationEquals(a: NodeEvaluation | null, b: NodeEvaluation | null): boolean {
  if (a === b) return true
  if (!a || !b || !nodeErrorsEqual(a.error, b.error) || !inputsEqual(a.inputs, b.inputs)) return false
  const ports = Object.keys(a.outputs)
  const otherPorts = Object.keys(b.outputs)
  return (
    ports.length === otherPorts.length &&
    ports.every(port => matricesEqual(a.outputs[port] ?? null, b.outputs[port] ?? null))
  )
}

function nodeDataEquals(a: FlowNodeData, b: FlowNodeData): boolean {
  return (
    a.source === b.source &&
    evaluationEquals(a.evaluation, b.evaluation) &&
    sameStrings(a.connectedInputs, b.connectedInputs) &&
    sameStrings(a.connectedOutputs, b.connectedOutputs)
  )
}

/**
 * Projects the domain graph onto React Flow nodes.
 *
 * React Flow owns the interaction state stored on a node object (position,
 * measured size, selection, dragging). Reusing the same object whenever its
 * `data` did not really change keeps that state alive: React Flow only reuses
 * its cached node measurement — and with it every wire's start and end point —
 * when it receives the exact same node object again.
 */
export function reconcileNodes(current: FlowNode[], graph: Graph, evaluation: Evaluation): FlowNode[] {
  const connected = collectConnectedPorts(graph)
  const currentById = new Map(current.map(node => [node.id, node]))
  let changed = current.length !== graph.nodes.length

  const next = graph.nodes.map(source => {
    const existing = currentById.get(source.id)
    const data = buildNodeData(source, connected, evaluation)
    if (existing && existing.type === source.kind && nodeDataEquals(existing.data, data)) {
      return existing
    }
    changed = true
    return {
      ...existing,
      id: source.id,
      type: source.kind,
      position: existing?.position ?? { x: source.x, y: source.y },
      data,
    }
  })

  return changed ? next : current
}

/**
 * Projects the domain graph's connections onto React Flow edges, reusing edge
 * objects whose wiring and error state did not change.
 */
export function reconcileEdges(current: Edge[], graph: Graph, evaluation: Evaluation): Edge[] {
  const currentById = new Map(current.map(edge => [edge.id, edge]))
  let changed = current.length !== graph.connections.length

  const next = graph.connections.map(connection => {
    const existing = currentById.get(connection.id)
    const target = graph.nodes.find(node => node.id === connection.to.node)
    const className = target && evaluation.get(target.id)?.error ? 'edge-error' : undefined
    if (
      existing &&
      existing.source === connection.from.node &&
      existing.sourceHandle === connection.from.port &&
      existing.target === connection.to.node &&
      existing.targetHandle === connection.to.port &&
      existing.className === className
    ) {
      return existing
    }
    changed = true
    return {
      ...existing,
      id: connection.id,
      source: connection.from.node,
      sourceHandle: connection.from.port,
      target: connection.to.node,
      targetHandle: connection.to.port,
      className,
    }
  })

  return changed ? next : current
}
