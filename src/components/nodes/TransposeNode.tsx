import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { WIDGET_SPECS } from '../../graph/widgets'
import type { FlowNode } from '../flowTypes'
import { useI18n } from '../../i18n/context'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

/** Y offset of the slot row: header (34) + body padding-top (10) + half row height (14). */
const SLOT_Y = 58

export function TransposeNode({ data, selected }: NodeProps<FlowNode>) {
  const { removeNode } = useContext(GraphActionsContext)
  const { t } = useI18n()
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  if (source.kind !== 'transpose') {
    return null
  }

  const transpose = evaluation?.outputs.transpose ?? null
  const missing = WIDGET_SPECS[source.kind].inputs.filter(port => !connectedInputs.includes(port.id))

  let status
  if (evaluation?.error) {
    const error = describeNodeError(t, evaluation.error)
    status = (
      <span className="msg error" title={error.detail}>
        {error.text}
      </span>
    )
  } else if (transpose) {
    status = <span className="msg ok">{t('multiply.result', { rows: transpose.rows, cols: transpose.cols })}</span>
  } else if (missing.length > 0) {
    const ports = missing.map(port => t(portLabelKey('transpose', port.id))).join(` ${t('conjunction.and')} `)
    status = <span className="msg dim">{t('transpose.waiting', { ports })}</span>
  } else {
    status = <span className="msg dim">{t('multiply.noValue')}</span>
  }

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.transpose)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="m"
            style={{ top: SLOT_Y }}
            className={connectedInputs.includes('m') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">{t(portLabelKey('transpose', 'm'))}</span>
        </div>
        <div className="status-row">{status}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="transpose"
        style={{ top: SLOT_Y }}
        className={connectedOutputs.includes('transpose') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
