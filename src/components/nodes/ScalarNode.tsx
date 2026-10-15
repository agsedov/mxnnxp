import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useCallback, useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import type { FlowNode } from '../flowTypes'
import { useI18n } from '../../i18n/context'
import { describeNodeError, WIDGET_TITLE_KEY } from '../../i18n/labels'

const SLOT_Y = 58

export function ScalarNode({ data, selected }: NodeProps<FlowNode>) {
  const { t } = useI18n()
  const { updateScalar, removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedOutputs } = data

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      updateScalar(source.id, event.target.value)
    },
    [source.id, updateScalar],
  )

  if (source.kind !== 'scalar') {
    return null
  }

  const value = source.data.value
  const valid = evaluation?.error ? false : true
  const error = evaluation?.error ? describeNodeError(t, evaluation.error) : null

  return (
    <div className={`widget${evaluation?.error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.scalar)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <div className="scalar-editor nodrag">
          <input
            className={`cell${valid ? '' : ' cell-invalid'}`}
            value={value}
            onChange={handleChange}
            spellCheck={false}
          />
        </div>
      </div>
      {error && (
        <div className="widget-message error" title={error.detail}>
          {error.text}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        id="s"
        style={{ top: SLOT_Y }}
        className={connectedOutputs.includes('s') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
