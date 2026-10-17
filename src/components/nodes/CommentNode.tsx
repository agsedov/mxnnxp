import type { NodeProps } from '@xyflow/react'
import { useCallback, useContext, useRef, useState } from 'react'
import { GraphActionsContext } from '../GraphActionsContext'
import { RichText } from '../RichText'
import type { FlowNode } from '../flowTypes'
import type { CommentNodeData } from '../../graph/types'
import { DEFAULT_COMMENT_WIDTH, MAX_COMMENT_WIDTH, MIN_COMMENT_WIDTH } from '../../graph/widgets'
import { useI18n } from '../../i18n/context'
import { LOCALES, type Locale } from '../../i18n/messages'

/**
 * A passive rectangle that carries a note in **both** interface languages, each
 * edited on its own: only the text of the active language is shown, and only it
 * is edited — switching the language reveals (and edits) the other side. The
 * body supports inline TeX (`$…$`, see `RichText`) over a faint technical grid.
 *
 * The border turns red while the language that is *not* on screen has nothing
 * written — the note exists, but it has no translation yet.
 *
 * There is no header and no slots: the widget is just the note. The body is the
 * drag handle, so a plain click turns it into a textarea (the editor itself is
 * `nodrag` so the caret works); a small button in the corner removes the
 * widget, and the ridged corner opposite it drags the box's **width**, which
 * is stored in the note so it survives a save or a share.
 */
export function CommentNode({ data, selected }: NodeProps<FlowNode>) {
  const { t, locale } = useI18n()
  const { updateComment, removeNode } = useContext(GraphActionsContext)
  const [editing, setEditing] = useState(false)
  const drag = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null)
  const { source } = data

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (source.kind !== 'comment') return
      const next = { ...source.data }
      next[locale] = event.target.value
      updateComment(source.id, next)
    },
    [source, locale, updateComment],
  )

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (source.kind !== 'comment') return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: widthOf(source.data),
      }
    },
    [source],
  )

  const resize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = drag.current
      if (!state || source.kind !== 'comment') return
      const next = clamp(state.startWidth + (event.clientX - state.startX))
      updateComment(source.id, { ...source.data, width: next })
    },
    [source, updateComment],
  )

  const endResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }, [])

  if (source.kind !== 'comment') {
    return null
  }

  const texts = source.data
  const text = texts[locale]
  const untranslated = isBlank(texts[otherLocale(locale)])
  const empty = isBlank(text)

  return (
    <div
      className={`widget comment-widget${selected ? ' widget-selected' : ''}${
        untranslated ? ' comment-untranslated' : ''
      }`}
      style={{ width: widthOf(texts) }}
    >
      <button className="comment-remove nodrag" title={t('widget.remove')} onClick={() => removeNode(source.id)}>
        ×
      </button>
      {editing ? (
        <textarea
          className="comment-editor nodrag"
          value={text}
          placeholder={t('comment.placeholder')}
          spellCheck={false}
          rows={Math.max(2, text.split('\n').length)}
          autoFocus
          onChange={handleChange}
          onBlur={() => setEditing(false)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.currentTarget.blur()
            }
          }}
        />
      ) : (
        <div
          className={`comment-text${empty ? ' comment-text-empty' : ''}`}
          title={t('comment.placeholder')}
          onClick={() => setEditing(true)}
        >
          {empty ? t('comment.placeholder') : <RichText text={text} />}
        </div>
      )}
      <div
        className="comment-resize nodrag"
        title={t('comment.resize')}
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </div>
  )
}

function widthOf(data: CommentNodeData): number {
  return clamp(data.width ?? DEFAULT_COMMENT_WIDTH)
}

function clamp(width: number): number {
  return Math.min(MAX_COMMENT_WIDTH, Math.max(MIN_COMMENT_WIDTH, Math.round(width)))
}

function isBlank(text: string): boolean {
  return text.trim().length === 0
}

/** The language that is not currently shown — the one a translation would fill in. */
function otherLocale(locale: Locale): Locale {
  return LOCALES.find(candidate => candidate !== locale) ?? locale
}
