import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { WIDGET_SPECS } from '../../graph/widgets'
import type { FlowNode } from '../flowTypes'
import { useI18n } from '../../i18n/context'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

/**
 * Y offsets of the slots, aligned with the body rows:
 * header (34) + body padding-top (10) + half row height (14), then one row lower.
 */
const SLOT_LEFT_Y = 58
const SLOT_RIGHT_Y = 86

export function MultiplyNode({ data, selected }: NodeProps<FlowNode>) {
  const { removeNode } = useContext(GraphActionsContext)
  const { t } = useI18n()
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  if (source.kind !== 'matrixMultiply') {
    return null
  }

  const product = evaluation?.outputs.product ?? null
  const missing = WIDGET_SPECS[source.kind].inputs.filter(port => !connectedInputs.includes(port.id))

  let status
  if (evaluation?.error) {
    const error = describeNodeError(t, evaluation.error)
    status = (
      <span className="msg error" title={error.detail}>
        {error.text}
      </span>
    )
  } else if (product) {
    status = <span className="msg ok">{t('multiply.result', { rows: product.rows, cols: product.cols })}</span>
  } else if (missing.length > 0) {
    const ports = missing.map(port => t(portLabelKey('matrixMultiply', port.id))).join(` ${t('conjunction.and')} `)
    status = <span className="msg dim">{t('multiply.waiting', { ports })}</span>
  } else {
    status = <span className="msg dim">{t('multiply.noValue')}</span>
  }

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.matrixMultiply)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
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
          <span className="slot-label">{t(portLabelKey('matrixMultiply', 'left'))}</span>
        </div>
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="right"
            style={{ top: SLOT_RIGHT_Y }}
            className={connectedInputs.includes('right') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">{t(portLabelKey('matrixMultiply', 'right'))}</span>
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
