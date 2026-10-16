import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useCallback, useContext } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import type { FlowNode } from '../flowTypes'
import { COS_SIN_TABLE, angleLabel } from '../../math/exact'
import { useI18n } from '../../i18n/context'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from '../../i18n/labels'

/**
 * Y offset of the output slot, aligned with the first body row:
 * header (34) + body padding-top (10) + half row height (14).
 */
const SLOT_Y = 58

/** The basic angles, in table order (ascending, each angle once). */
const ANGLES = Object.keys(COS_SIN_TABLE)

/**
 * A source widget: picking one of the basic angles emits the exact 2D rotation
 * matrix `[[cos, -sin], [sin, cos]]` for it. The angle list and the exact
 * cos/sin values come straight from `COS_SIN_TABLE`, so nothing is approximated.
 */
export function RotationNode({ data, selected }: NodeProps<FlowNode>) {
  const { t } = useI18n()
  const { updateRotation, removeNode } = useContext(GraphActionsContext)
  const { source, evaluation, connectedOutputs } = data

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      if (source.kind === 'rotation') updateRotation(source.id, { angle: event.target.value })
    },
    [source, updateRotation],
  )

  if (source.kind !== 'rotation') {
    return null
  }

  const angle = ANGLES.includes(source.data.angle) ? source.data.angle : '0'
  const error = evaluation?.error ? describeNodeError(t, evaluation.error) : null

  return (
    <div className={`widget${error ? ' widget-error' : ''}${selected ? ' widget-selected' : ''}`}>
      <div className="widget-header">
        <span className="widget-title">{t(WIDGET_TITLE_KEY.rotation)}</span>
        <button className="widget-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
          ×
        </button>
      </div>
      <div className="widget-body">
        <div className="slot-row">
          <span className="slot-label">{t('rotation.angle')}</span>
          <select className="angle-select nodrag" value={angle} onChange={handleChange}>
            {ANGLES.map(key => (
              <option key={key} value={key}>
                {angleLabel(key)}
              </option>
            ))}
          </select>
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
        id="m"
        style={{ top: SLOT_Y }}
        title={t(portLabelKey('rotation', 'm'))}
        className={connectedOutputs.includes('m') ? 'slot-connected' : undefined}
      />
    </div>
  )
}
