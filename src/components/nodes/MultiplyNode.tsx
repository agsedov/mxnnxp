import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { WIDGET_SPECS } from '../../graph/widgets'
import type { FlowNode } from '../flowTypes'

/**
 * Y offsets of the slots, aligned with the body rows:
 * header (34) + body padding-top (10) + half row height (14), then one row lower.
 */
const SLOT_LEFT_Y = 58
const SLOT_RIGHT_Y = 86

export function MultiplyNode({ data, selected }: NodeProps<FlowNode>) {
  const { removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  if (source.kind !== 'matrixMultiply') {
    return null
  }

  const product = evaluation?.outputs.product ?? null
  const missing = WIDGET_SPECS[source.kind].inputs.filter(port => !connectedInputs.includes(port.id))

  let status
  if (evaluation?.error) {
    status = <span className="msg error">{evaluation.error}</span>
  } else if (product) {
    status = <span className="msg ok">{`${product.rows}×${product.cols} result`}</span>
  } else if (missing.length > 0) {
    status = <span className="msg dim">waiting for {missing.map(port => port.label.toLowerCase()).join(' and ')}</span>
  } else {
    status = <span className="msg dim">no value yet</span>
  }

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">Matrix multiply</span>
        <button className="widget-remove nodrag" title="Remove widget" onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            style={{ top: SLOT_LEFT_Y }}
            className={connectedInputs.includes('left') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">Left</span>
        </div>
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="right"
            style={{ top: SLOT_RIGHT_Y }}
            className={connectedInputs.includes('right') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">Right</span>
        </div>
        <div className="status-row">{status}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="product"
        style={{ top: SLOT_LEFT_Y }}
        className={connectedOutputs.includes('product') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
