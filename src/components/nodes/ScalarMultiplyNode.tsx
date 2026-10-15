import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { WIDGET_SPECS } from '../../graph/widgets'
import type { FlowNode } from '../flowTypes'
import { useI18n } from '../../i18n/context'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

const SLOT_MATRIX_Y = 58
const SLOT_SCALAR_Y = 86

export function ScalarMultiplyNode({ data, selected }: NodeProps<FlowNode>) {
  const { removeNode } = useContext(GraphActionsContext)
  const { t } = useI18n()
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  if (source.kind !== 'scalarMultiply') {
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
    const ports = missing.map(port => t(portLabelKey('scalarMultiply', port.id))).join(` ${t('conjunction.and')} `)
    status = <span className="msg dim">{t('scalarMultiply.waiting', { ports })}</span>
  } else {
    status = <span className="msg dim">{t('multiply.noValue')}</span>
  }

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.scalarMultiply)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="matrix"
            style={{ top: SLOT_MATRIX_Y }}
            className={connectedInputs.includes('matrix') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">{t(portLabelKey('scalarMultiply', 'matrix'))}</span>
        </div>
        <div className="slot-row">
          <Handle
            type="target"
            position={Position.Left}
            id="scalar"
            style={{ top: SLOT_SCALAR_Y }}
            className={connectedInputs.includes('scalar') ? 'slot-connected' : undefined}
          />
          <span className="slot-label">{t(portLabelKey('scalarMultiply', 'scalar'))}</span>
        </div>
        <div className="status-row">{status}</div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="product"
        style={{ top: SLOT_MATRIX_Y }}
        className={connectedOutputs.includes('product') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
