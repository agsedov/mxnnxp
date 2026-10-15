import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useCallback, useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { MatrixEditor } from '../MatrixEditor'
import { MatrixView } from '../MatrixView'
import type { FlowNode } from '../flowTypes'
import type { MatrixNodeData } from '../../graph/types'
import { MATRIX_INPUT_PORT } from '../../graph/widgets'
import { useI18n } from '../../i18n/context'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

/**
 * Y offset of the slots, aligned with the first body row:
 * header (34) + body padding-top (10) + half row height (14).
 */
const SLOT_Y = 58

export function MatrixNode({ data, selected }: NodeProps<FlowNode>) {
  const { t } = useI18n()
  const { updateMatrix, removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedInputs, connectedOutputs } = data

  const handleChange = useCallback(
    (next: MatrixNodeData) => updateMatrix(source.id, next),
    [source.id, updateMatrix],
  )

  if (source.kind !== 'matrix') {
    return null
  }

  // While the input slot is connected the widget is driven by it: the incoming
  // matrix is shown read-only and its own editable values are not in use.
  const driven = connectedInputs.includes(MATRIX_INPUT_PORT)
  const incoming = driven ? (evaluation?.outputs.m ?? null) : null
  const error = evaluation?.error ? describeNodeError(t, evaluation.error) : null

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.matrix)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        {driven ? (
          <>
            <div className="slot-row">
              <span className="slot-label">{t(portLabelKey('matrix', MATRIX_INPUT_PORT))}</span>
              <span className="msg dim">{incoming ? t('matrix.driven') : t('matrix.waiting')}</span>
            </div>
            {incoming && <MatrixView matrix={incoming} />}
          </>
        ) : (
          <MatrixEditor data={source.data} onChange={handleChange} />
        )}
      </div>
      {error && (
        <div className="widget-message error" title={error.detail}>
          {error.text}
        </div>
      )}
      <Handle
        type="target"
        position={Position.Left}
        id={MATRIX_INPUT_PORT}
        style={{ top: SLOT_Y }}
        className={driven ? 'slot-connected' : undefined}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="m"
        style={{ top: SLOT_Y }}
        className={connectedOutputs.includes('m') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
