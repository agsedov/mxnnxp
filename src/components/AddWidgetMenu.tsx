import { useEffect, useRef, useState } from 'react'
import type { WidgetKind } from '../graph/types'
import { useI18n } from '../i18n/context'
import { WIDGET_TITLE_KEY } from '../i18n/labels'

/** Every widget kind the toolbar can add, in the order the menu lists them. */
const ADDABLE_WIDGETS: readonly WidgetKind[] = [
  'matrix',
  'matrixMultiply',
  'rowEchelon',
  'scalar',
  'scalarMultiply',
  'vectorCanvas',
  'rotation',
  'comment',
]

/**
 * Toolbar dropdown that adds a widget: one entry per kind, named exactly as the
 * widget's own header names it (`WIDGET_TITLE_KEY`), so the menu and the
 * resulting widget always agree — in either language.
 *
 * The menu closes when an entry is picked, on a click outside it, and on
 * Escape. It stays in the DOM's tab order only while open.
 */
export function AddWidgetMenu({ onAdd }: { onAdd: (kind: WidgetKind) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const choose = (kind: WidgetKind) => {
    setOpen(false)
    onAdd(kind)
  }

  return (
    <div className="add-menu" ref={rootRef}>
      <button
        type="button"
        className="btn add-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
      >
        {t('toolbar.addMenu')}
      </button>
      {open && (
        <div className="add-menu-list" role="menu">
          {ADDABLE_WIDGETS.map(kind => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              className="add-menu-item"
              onClick={() => choose(kind)}
            >
              {t(WIDGET_TITLE_KEY[kind])}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
