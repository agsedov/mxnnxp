import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useCallback, useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import type { FlowNode } from '../flowTypes'
import { useI18n } from '../../i18n/context'
import { portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

const SLOT_Y = 58

export function VectorCanvasNode({ data, selected }: NodeProps<FlowNode>) {
  const { t } = useI18n()
  const { removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedInputs } = data

  if (source.kind !== 'vectorCanvas') {
    return null
  }

  const mode = source.data.mode

  return (
    <div className={`widget${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.vectorCanvas)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <div className="slot-row">
          <span className="slot-label">{t(portLabelKey('vectorCanvas', 'm'))}</span>
          <span className="msg dim">{mode === 'rows' ? t('vectorCanvas.mode.rows') : t('vectorCanvas.mode.cols')}</span>
        </div>
        <div className="vector-canvas-placeholder nodrag" />
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="m"
        style={{ top: SLOT_Y }}
        className={connectedInputs.includes('m') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
