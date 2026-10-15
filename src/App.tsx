import { useCallback, useMemo, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'

import { GraphActionsContext } from './components/GraphActionsContext'
import { MatrixNode } from './components/nodes/MatrixNode'
import { MultiplyNode } from './components/nodes/MultiplyNode'
import type { FlowNode } from './components/flowTypes'
import {
  addNode,
  connect,
  createGraph,
  disconnect,
  evaluateGraph,
  moveNode,
  removeNode,
  updateMatrixData,
} from './graph/engine'
import { WIDGET_SPECS } from './graph/widgets'
import type { Graph, MatrixNodeData, NodeId, WidgetKind } from './graph/types'

const NODE_TYPES = {
  matrix: MatrixNode,
  matrixMultiply: MultiplyNode,
}

/** Demo scene: A × B with both factors editable. */
function createInitialGraph(): Graph {
  let graph = createGraph()
  graph = addNode(graph, 'matrix', 40, 90)
  graph = addNode(graph, 'matrix', 40, 430)
  graph = addNode(graph, 'matrixMultiply', 430, 260)
  const [factorA, factorB, product] = graph.nodes
  graph = connect(graph, { node: factorA.id, port: 'm' }, { node: product.id, port: 'a' })
  graph = connect(graph, { node: factorB.id, port: 'm' }, { node: product.id, port: 'b' })
  return graph
}

export default function App() {
  const [graph, setGraph] = useState<Graph>(createInitialGraph)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<NodeId>>(() => new Set())

  const evaluation = useMemo(() => evaluateGraph(graph), [graph])

  const linkedPorts = useMemo(() => {
    const inputs = new Set<string>()
    const outputs = new Set<string>()
    for (const connection of graph.connections) {
      inputs.add(`${connection.to.node}:${connection.to.port}`)
      outputs.add(`${connection.from.node}:${connection.from.port}`)
    }
    return { inputs, outputs }
  }, [graph])

  const nodes = useMemo<FlowNode[]>(
    () =>
      graph.nodes.map(node => {
        const spec = WIDGET_SPECS[node.kind]
        return {
          id: node.id,
          type: node.kind,
          position: { x: node.x, y: node.y },
          selected: selectedIds.has(node.id),
          data: {
            source: node,
            evaluation: evaluation.get(node.id) ?? null,
            connectedInputs: spec.inputs.filter(p => linkedPorts.inputs.has(`${node.id}:${p.id}`)).map(p => p.id),
            connectedOutputs: spec.outputs.filter(p => linkedPorts.outputs.has(`${node.id}:${p.id}`)).map(p => p.id),
          },
        }
      }),
    [graph, evaluation, linkedPorts, selectedIds],
  )

  const edges = useMemo<Edge[]>(
    () =>
      graph.connections.map(connection => {
        const target = graph.nodes.find(node => node.id === connection.to.node)
        const hasError = target ? Boolean(evaluation.get(target.id)?.error) : false
        return {
          id: connection.id,
          source: connection.from.node,
          sourceHandle: connection.from.port,
          target: connection.to.node,
          targetHandle: connection.to.port,
          className: hasError ? 'edge-error' : undefined,
        }
      }),
    [graph, evaluation],
  )

  const onNodesChange = useCallback((changes: NodeChange<FlowNode>[]) => {
    setGraph(current => {
      let next = current
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          next = moveNode(next, change.id, change.position.x, change.position.y)
        } else if (change.type === 'remove') {
          next = removeNode(next, change.id)
        }
      }
      return next
    })
    setSelectedIds(current => {
      let next = current
      for (const change of changes) {
        if (change.type === 'select') {
          const updated = new Set(next)
          if (change.selected) updated.add(change.id)
          else updated.delete(change.id)
          next = updated
        } else if (change.type === 'remove') {
          const updated = new Set(next)
          updated.delete(change.id)
          next = updated
        }
      }
      return next
    })
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setGraph(current =>
      changes.reduce((acc, change) => (change.type === 'remove' ? disconnect(acc, change.id) : acc), current),
    )
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, sourceHandle, target, targetHandle } = connection
      if (!source || !sourceHandle || !target || !targetHandle) return
      try {
        setGraph(connect(graph, { node: source, port: sourceHandle }, { node: target, port: targetHandle }))
      } catch {
        // Invalid attempt — `isValidConnection` should already filter these out.
      }
    },
    [graph],
  )

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const { source, sourceHandle, target, targetHandle } = connection
    if (!source || !sourceHandle || !target || !targetHandle || source === target) return false
    const sourceNode = graph.nodes.find(node => node.id === source)
    const targetNode = graph.nodes.find(node => node.id === target)
    if (!sourceNode || !targetNode) return false
    return (
      WIDGET_SPECS[sourceNode.kind].outputs.some(port => port.id === sourceHandle) &&
      WIDGET_SPECS[targetNode.kind].inputs.some(port => port.id === targetHandle)
    )
  }, [graph])

  const graphActions = useMemo(
    () => ({
      updateMatrix: (id: NodeId, data: MatrixNodeData) => setGraph(current => updateMatrixData(current, id, data)),
      removeNode: (id: NodeId) => setGraph(current => removeNode(current, id)),
    }),
    [],
  )

  const addWidget = useCallback((kind: WidgetKind) => {
    setGraph(current => {
      const cascade = current.nodes.length % 6
      return addNode(current, kind, 120 + cascade * 36, 120 + cascade * 36)
    })
  }, [])

  const reset = useCallback(() => {
    setSelectedIds(new Set())
    setGraph(createInitialGraph())
  }, [])

  return (
    <div className="app">
      <GraphActionsContext.Provider value={graphActions}>
        <header className="toolbar">
          <span className="brand">mxnnxp</span>
          <button className="btn" onClick={() => addWidget('matrix')}>
            + Matrix
          </button>
          <button className="btn" onClick={() => addWidget('matrixMultiply')}>
            + Multiply
          </button>
          <button className="btn btn-quiet" onClick={reset}>
            Reset
          </button>
          <span className="hint">
            drag widgets to move · drag a slot onto another to connect · click a wire or press ⌫ to remove
          </span>
        </header>
        <div className="canvas">
          <ReactFlow<FlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onEdgeClick={(_, edge) => setGraph(current => disconnect(current, edge.id))}
            isValidConnection={isValidConnection}
            colorMode="dark"
            fitView
            minZoom={0.25}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#313746" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor="#2b3345" maskColor="rgba(8, 10, 14, 0.75)" />
          </ReactFlow>
        </div>
      </GraphActionsContext.Provider>
    </div>
  )
}
