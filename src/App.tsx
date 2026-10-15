import { useCallback, useMemo, useState } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
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
import { LanguageSwitch } from './components/LanguageSwitch'
import { MatrixNode } from './components/nodes/MatrixNode'
import { MultiplyNode } from './components/nodes/MultiplyNode'
import { ScalarNode } from './components/nodes/ScalarNode'
import { ScalarMultiplyNode } from './components/nodes/ScalarMultiplyNode'
import type { FlowNode } from './components/flowTypes'
import { reconcileEdges, reconcileNodes } from './components/flowSync'
import { useI18n } from './i18n/context'
import {
  addNode,
  connect,
  createGraph,
  disconnect,
  evaluateGraph,
  moveNode,
  removeNode,
  updateMatrixData,
  updateScalarData,
} from './graph/engine'
import { WIDGET_SPECS } from './graph/widgets'
import type { Graph, MatrixNodeData, NodeId, WidgetKind } from './graph/types'

const NODE_TYPES = {
  matrix: MatrixNode,
  matrixMultiply: MultiplyNode,
  scalar: ScalarNode,
  scalarMultiply: ScalarMultiplyNode,
}

/** Demo scene: A × B with both factors editable. */
function createInitialGraph(): Graph {
  let graph = createGraph()
  graph = addNode(graph, 'matrix', 40, 90)
  graph = addNode(graph, 'matrix', 40, 430)
  graph = addNode(graph, 'matrixMultiply', 430, 260)
  const [factorA, factorB, product] = graph.nodes
  graph = connect(graph, { node: factorA.id, port: 'm' }, { node: product.id, port: 'left' })
  graph = connect(graph, { node: factorB.id, port: 'm' }, { node: product.id, port: 'right' })
  return graph
}

export default function App() {
  const { t } = useI18n()
  const [graph, setGraph] = useState<Graph>(createInitialGraph)

  const evaluation = useMemo(() => evaluateGraph(graph), [graph])

  // React Flow owns the interaction state (position, measured size, selection)
  // and is the only writer of `flowNodes` / `flowEdges`. The domain graph is
  // projected onto them at render time, reusing every object whose data did not
  // really change — React Flow only keeps its cached node measurement (and with
  // it all wire endpoints) for objects it receives unchanged.
  const [flowNodes, setFlowNodes] = useState<FlowNode[]>(() => reconcileNodes([], graph, evaluation))
  const [flowEdges, setFlowEdges] = useState<Edge[]>(() => reconcileEdges([], graph, evaluation))
  const nodes = useMemo(() => reconcileNodes(flowNodes, graph, evaluation), [flowNodes, graph, evaluation])
  const edges = useMemo(() => reconcileEdges(flowEdges, graph, evaluation), [flowEdges, graph, evaluation])

  // Every change React Flow emits is applied verbatim to the interaction state.
  // Changes are applied on top of the reconciled array so that changes referring
  // to a just-added node (in particular its measured size) are not dropped.
  // Removals additionally propagate into the domain graph.
  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode>[]) => {
      setFlowNodes(current => applyNodeChanges(changes, reconcileNodes(current, graph, evaluation)))
      const removedIds: string[] = []
      for (const change of changes) {
        if (change.type === 'remove') removedIds.push(change.id)
      }
      if (removedIds.length > 0) {
        setGraph(current => removedIds.reduce((acc, id) => removeNode(acc, id), current))
      }
    },
    [graph, evaluation],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setFlowEdges(current => applyEdgeChanges(changes, reconcileEdges(current, graph, evaluation)))
      const removedIds: string[] = []
      for (const change of changes) {
        if (change.type === 'remove') removedIds.push(change.id)
      }
      if (removedIds.length > 0) {
        setGraph(current => removedIds.reduce((acc, id) => disconnect(acc, id), current))
      }
    },
    [graph, evaluation],
  )

  // React Flow is authoritative for positions while dragging; the settled
  // position is written back into the domain graph so it stays serializable.
  const onNodeDragStop = useCallback((_event: unknown, node: FlowNode) => {
    setGraph(current => moveNode(current, node.id, node.position.x, node.position.y))
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
      updateScalar: (id: NodeId, value: string) => setGraph(current => updateScalarData(current, id, value)),
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
    setGraph(createInitialGraph())
  }, [])

  return (
    <div className="app">
      <GraphActionsContext.Provider value={graphActions}>
        <header className="toolbar">
          <span className="brand">mxnnxp</span>
          <button className="btn" onClick={() => addWidget('matrix')}>
            {t('toolbar.addMatrix')}
          </button>
          <button className="btn" onClick={() => addWidget('matrixMultiply')}>
            {t('toolbar.addMultiply')}
          </button>
          <button className="btn" onClick={() => addWidget('scalar')}>
            {t('toolbar.addScalar')}
          </button>
          <button className="btn" onClick={() => addWidget('scalarMultiply')}>
            {t('toolbar.addScalarMultiply')}
          </button>
          <button className="btn" onClick={() => addWidget('vectorCanvas')}>
            {t('toolbar.addVectorCanvas')}
          </button>
          <button className="btn btn-quiet" onClick={reset}>
            {t('toolbar.reset')}
          </button>
          <span className="hint">{t('toolbar.hint')}</span>
          <LanguageSwitch />
        </header>
        <div className="canvas">
          <ReactFlow<FlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
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
