import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { MatrixView } from '../MatrixView'
import type { FlowNode } from '../flowTypes'

/**
 * Y offsets of the slots, aligned with the body rows:
 * header (34) + body padding-top (10) + half row height (14), then one row lower.
 */
const SLOT_A_Y = 58
const SLOT_B_Y = 86

export function MultiplyNode({ data, selected }: NodeProps<FlowNode>) {
  const { removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  if (source.kind !== 'matrixMultiply') {
    return null
  }

  const product = evaluation?.outputs.product ?? null
  const missing = (['a', 'b'] as const).filter(id => !connectedInputs.includes(id))

  let status
  if (evaluation?.error) {
    status = <span className="msg error">{evaluation.error}</span>
  } else if (product) {
    status = <span className="msg ok">{`${product.rows}×${product.cols} result`}</span>
  } else if (missing.length > 0) {
    status = <span className="msg dim">waiting for {missing.join(' and ')}</span>
  } else {
    status = <span className="msg dim">no value yet</span>
  }

  return (
    <div className={`widget wide${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
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
            id="a"
            style={{ top: SLOT_A_Y }}
            className={connectedInputs.includes('a') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">A</span>
        </div>
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="b"
            style={{ top: SLOT_B_Y }}
            className={connectedInputs.includes('b') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">B</span>
        </div>
        <div className="status-row">{status}</div>
        {product && <MatrixView matrix={product} />}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="product"
        style={{ top: SLOT_A_Y }}
        className={connectedOutputs.includes('product') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
