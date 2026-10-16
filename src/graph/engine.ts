import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'
import { WIDGET_SPECS, MATRIX_INPUT_PORT, defaultMatrixData, defaultScalarData, defaultVectorCanvasData, evaluateNode } from './widgets'
import type {
  Connection,
  Evaluation,
  Graph,
  GraphNode,
  MatrixNodeData,
  NodeId,
  PortRef,
  VectorCanvasNodeData,
  WidgetKind,
} from './types'

function newId(): string {
  return crypto.randomUUID()
}

export function createGraph(): Graph {
  return { nodes: [], connections: [] }
}

export function addNode(graph: Graph, kind: WidgetKind, x: number, y: number): Graph {
  const id = newId()
  const node: GraphNode =
    kind === 'matrix'
      ? { id, kind, x, y, data: defaultMatrixData() }
      : kind === 'scalar'
        ? { id, kind, x, y, data: defaultScalarData() }
        : kind === 'vectorCanvas'
          ? { id, kind, x, y, data: defaultVectorCanvasData() }
          : { id, kind, x, y }
  return { nodes: [...graph.nodes, node], connections: graph.connections }
}

/** Removes a widget and every connection attached to it. */
export function removeNode(graph: Graph, id: NodeId): Graph {
  return {
    nodes: graph.nodes.filter(node => node.id !== id),
    connections: graph.connections.filter(c => c.from.node !== id && c.to.node !== id),
  }
}

export function moveNode(graph: Graph, id: NodeId, x: number, y: number): Graph {
  return { ...graph, nodes: graph.nodes.map(node => (node.id === id ? { ...node, x, y } : node)) }
}

/**
 * Replaces a matrix widget's editable values. Ignored while the widget is driven
 * by its input slot — it is read-only then and its own values are not in use.
 */
export function updateMatrixData(graph: Graph, id: NodeId, data: MatrixNodeData): Graph {
  if (isDriven(graph, id)) return graph
  return {
    ...graph,
    nodes: graph.nodes.map(node => (node.id === id && node.kind === 'matrix' ? { ...node, data } : node)),
  }
}

export function updateScalarData(graph: Graph, id: NodeId, value: string): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map(node => (node.id === id && node.kind === 'scalar' ? { ...node, data: { value } } : node)),
  }
}

/** Switches a vector canvas between reading rows and reading columns. */
export function updateVectorCanvasData(graph: Graph, id: NodeId, data: VectorCanvasNodeData): Graph {
  return {
    ...graph,
    nodes: graph.nodes.map(node => (node.id === id && node.kind === 'vectorCanvas' ? { ...node, data } : node)),
  }
}

/** Whether a widget's input slot currently carries a connection. */
function isDriven(graph: Graph, id: NodeId): boolean {
  return graph.connections.some(connection => connection.to.node === id && connection.to.port === MATRIX_INPUT_PORT)
}

/**
 * Connects an output slot to an input slot.
 *
 * The destination input can only have one connection: an existing connection
 * into the same slot is replaced. Throws when either slot does not exist or
 * when a widget is connected to itself.
 */
export function connect(graph: Graph, from: PortRef, to: PortRef): Graph {
  assertPort(graph, from.node, from.port, 'output')
  assertPort(graph, to.node, to.port, 'input')
  if (from.node === to.node) {
    throw new Error('Cannot connect a widget to itself')
  }
  const connections = graph.connections.filter(c => !(c.to.node === to.node && c.to.port === to.port))
  return { nodes: graph.nodes, connections: [...connections, { id: newId(), from, to }] }
}

export function disconnect(graph: Graph, connectionId: string): Graph {
  return { ...graph, connections: graph.connections.filter(c => c.id !== connectionId) }
}

function assertPort(graph: Graph, nodeId: NodeId, portId: string, direction: 'input' | 'output'): void {
  const node = graph.nodes.find(n => n.id === nodeId)
  if (!node) {
    throw new Error(`Unknown widget ${nodeId}`)
  }
  const spec = WIDGET_SPECS[node.kind]
  const ports = direction === 'output' ? spec.outputs : spec.inputs
  if (!ports.some(p => p.id === portId)) {
    throw new Error(`Widget "${spec.kind}" has no ${direction} slot "${portId}"`)
  }
}

/**
 * Evaluates the whole graph in topological order.
 *
 * Widgets that end up inside a cycle are reported with a "Cycle detected"
 * error. Errors do not propagate further than the widget itself: downstream
 * widgets simply receive no value on the corresponding slot.
 */
export function evaluateGraph(graph: Graph): Evaluation {
  const evaluation: Evaluation = new Map()
  const nodeById = new Map<NodeId, GraphNode>(graph.nodes.map(node => [node.id, node]))

  const outgoing = new Map<NodeId, Connection[]>()
  const incoming = new Map<NodeId, Connection[]>()
  const indegree = new Map<NodeId, number>()
  for (const node of graph.nodes) {
    outgoing.set(node.id, [])
    incoming.set(node.id, [])
    indegree.set(node.id, 0)
  }

  // Ignore dangling connections and connections to slots that do not exist.
  for (const connection of graph.connections) {
    const from = nodeById.get(connection.from.node)
    const to = nodeById.get(connection.to.node)
    if (!from || !to || from.id === to.id) continue
    if (!WIDGET_SPECS[from.kind].outputs.some(p => p.id === connection.from.port)) continue
    if (!WIDGET_SPECS[to.kind].inputs.some(p => p.id === connection.to.port)) continue
    outgoing.get(from.id)?.push(connection)
    incoming.get(to.id)?.push(connection)
    indegree.set(to.id, (indegree.get(to.id) ?? 0) + 1)
  }

  // Kahn's algorithm for a topological order.
  const queue: NodeId[] = graph.nodes.filter(n => (indegree.get(n.id) ?? 0) === 0).map(n => n.id)
  const ordered: GraphNode[] = []
  while (queue.length > 0) {
    const id = queue.shift() as NodeId
    const node = nodeById.get(id) as GraphNode
    ordered.push(node)
    for (const connection of outgoing.get(id) ?? []) {
      const remaining = (indegree.get(connection.to.node) ?? 0) - 1
      indegree.set(connection.to.node, remaining)
      if (remaining === 0) {
        queue.push(connection.to.node)
      }
    }
  }

  const outputsByNode = new Map<NodeId, Record<string, Matrix<Algebraic> | null>>()
  for (const node of ordered) {
    const inputs: Record<string, Matrix<Algebraic> | null> = {}
    const connectedInputs = new Set<string>()
    for (const port of WIDGET_SPECS[node.kind].inputs) {
      inputs[port.id] = null
    }
    for (const connection of incoming.get(node.id) ?? []) {
      inputs[connection.to.port] = outputsByNode.get(connection.from.node)?.[connection.from.port] ?? null
      connectedInputs.add(connection.to.port)
    }
    const result = evaluateNode(node, inputs, connectedInputs)
    outputsByNode.set(node.id, result.outputs)
    evaluation.set(node.id, { ...result, inputs })
  }

  // Everything not visited by Kahn's algorithm is part of (or downstream of) a cycle.
  for (const node of graph.nodes) {
    if (!evaluation.has(node.id)) {
      evaluation.set(node.id, { outputs: {}, error: { code: 'cycle' } })
    }
  }

  return evaluation
}
