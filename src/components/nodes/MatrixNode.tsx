import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useCallback, useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { MatrixEditor } from '../MatrixEditor'
import type { FlowNode } from '../flowTypes'
import type { MatrixNodeData } from '../../graph/types'

/**
 * Y offset of the output slot, aligned with the first body row:
 * header (34) + body padding-top (10) + half row height (14).
 */
const OUTPUT_SLOT_Y = 58

export function MatrixNode({ data, selected }: NodeProps<FlowNode>) {
  const { updateMatrix, removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedOutputs } = data

  const handleChange = useCallback(
    (next: MatrixNodeData) => updateMatrix(source.id, next),
    [source.id, updateMatrix],
  )

  if (source.kind !== 'matrix') {
    return null
  }

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">Matrix</span>
        <button className="widget-remove nodrag" title="Remove widget" onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <MatrixEditor data={source.data} onChange={handleChange} />
      </div>
      {evaluation?.error && <div className="widget-message error">{evaluation.error}</div>}
      <Handle
        type="source"
        position={Position.Right}
        id="m"
        style={{ top: OUTPUT_SLOT_Y }}
        className={connectedOutputs.includes('m') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
