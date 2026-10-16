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

export function RowEchelonNode({ data, selected }: NodeProps<FlowNode>) {
  const { removeNode } = useContext(GraphActionsContext)
  const { t } = useI18n()
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  if (source.kind !== 'rowEchelon') {
    return null
  }

  const ref = evaluation?.outputs.ref ?? null
  const missing = WIDGET_SPECS[source.kind].inputs.filter(port => !connectedInputs.includes(port.id))

  let status
  if (evaluation?.error) {
    const error = describeNodeError(t, evaluation.error)
    status = (
      <span className="msg error" title={error.detail}>
        {error.text}
      </span>
    )
  } else if (ref) {
    status = <span className="msg ok">{t('multiply.result', { rows: ref.rows, cols: ref.cols })}</span>
  } else if (missing.length > 0) {
    const ports = missing.map(port => t(portLabelKey('rowEchelon', port.id))).join(` ${t('conjunction.and')} `)
    status = <span className="msg dim">{t('rowEchelon.waiting', { ports })}</span>
  } else {
    status = <span className="msg dim">{t('multiply.noValue')}</span>
  }

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.rowEchelon)}</span>
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
          <span className="slot-label">{t(portLabelKey('rowEchelon', 'm'))}</span>
        </div>
        <div className="status-row">{status}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="ref"
        style={{ top: SLOT_Y }}
        className={connectedOutputs.includes('ref') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
