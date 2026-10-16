import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { buildPlotVectors } from '../plotVectors'
import { VectorPlot } from '../VectorPlot'
import type { FlowNode } from '../flowTypes'
import type { VectorCanvasMode } from '../../graph/types'
import { useI18n } from '../../i18n/context'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

/**
 * Y offset of the input slot, aligned with the first body row:
 * header (34) + body padding-top (10) + half row height (14).
 */
const SLOT_Y = 58

export function VectorCanvasNode({ data, selected }: NodeProps<FlowNode>) {
  const { t } = useI18n()
  const { removeNode, updateVectorCanvas } = useContext(GraphActionsContext)
  const { source, evaluation, connectedInputs } = data

  if (source.kind !== 'vectorCanvas') {
    return null
  }

  const mode = source.data.mode
  const connected = connectedInputs.includes('m')
  const matrix = connected ? (evaluation?.inputs?.m ?? null) : null
  const error = evaluation?.error ? describeNodeError(t, evaluation.error) : null
  const vectors = matrix && !error ? buildPlotVectors(matrix, mode) : []

  const setMode = (next: VectorCanvasMode) => updateVectorCanvas(source.id, { mode: next })

  let status
  if (!connected) {
    const ports = t(portLabelKey('vectorCanvas', 'm'))
    status = <span className="msg dim">{t('vectorCanvas.waiting', { ports })}</span>
  } else if (!matrix) {
    status = <span className="msg dim">{t('vectorCanvas.error.type')}</span>
  } else {
    status = <span className="msg ok">{t('vectorCanvas.count', { count: vectors.length })}</span>
  }

  return (
    <div className={`widget${error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.vectorCanvas)}</span>
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
            className={connected ? 'slot-connected' : undefined}
          />
          <span className="slot-label">{t(portLabelKey('vectorCanvas', 'm'))}</span>
        </div>
        <div className="mode-row">
          <span className="slot-label">{t('vectorCanvas.mode.label')}</span>
          <div className="mode-switch nodrag">
            <button
              className={`mode-btn${mode === 'rows' ? ' mode-btn-active' : ''}`}
              title={t('vectorCanvas.mode.rows')}
              onClick={() => setMode('rows')}
            >
              {t('vectorCanvas.mode.rows.short')}
            </button>
            <button
              className={`mode-btn${mode === 'cols' ? ' mode-btn-active' : ''}`}
              title={t('vectorCanvas.mode.cols')}
              onClick={() => setMode('cols')}
            >
              {t('vectorCanvas.mode.cols.short')}
            </button>
          </div>
        </div>
        {!error && <div className="status-row">{status}</div>}
        {!error && vectors.length > 0 && <VectorPlot vectors={vectors} />}
      </div>
      {error && (
        <div className="widget-message error" title={error.detail}>
          {error.text}
        </div>
      )}
    </div>
  )
}
