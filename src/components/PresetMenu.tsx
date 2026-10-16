import { useEffect, useRef, useState } from 'react'
import type { Graph } from '../graph/types'
import { loadPreset, loadPresetCatalog, type PresetEntry } from '../presets'
import { useI18n } from '../i18n/context'

/** Where the dropdown stands with the catalog: not asked yet, in flight, … */
type CatalogState = 'idle' | 'loading' | 'ready' | 'failed'

/** What the trigger shows about the last pick. */
type PickState = 'idle' | 'loading' | 'failed'

/**
 * Toolbar dropdown that opens a saved scene: one entry per preset listed in
 * `presets/index.json`, named in the active language. Picking an entry fetches
 * that preset's static file and replaces the canvas with it; a preset that
 * cannot be fetched or decoded leaves the canvas as it is, with the failure
 * shown on the trigger for a moment.
 *
 * Both files are static, so this works on any file server. The catalog is
 * fetched on the first open (not on boot) and cached; each preset file is
 * fetched only when its entry is picked.
 *
 * Closes on choice, on a click outside it, and on Escape — like the Add…
 * menu — and is in the tab order only while open.
 */
export function PresetMenu({ onOpen }: { onOpen: (graph: Graph) => void }) {
  const { t, locale } = useI18n()
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<CatalogState>('idle')
  const [presets, setPresets] = useState<PresetEntry[]>([])
  const [pick, setPick] = useState<PickState>('idle')
  const rootRef = useRef<HTMLDivElement | null>(null)
  // Picks are asynchronous and can overlap; only the most recent one may apply.
  const pickSerial = useRef(0)

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

  // The failure notice clears itself, like the "Link copied" confirmation.
  useEffect(() => {
    if (pick !== 'failed') return
    const timer = window.setTimeout(() => setPick('idle'), 1600)
    return () => window.clearTimeout(timer)
  }, [pick])

  // Fetch the catalog on the first open (and retry after a failed fetch, which
  // is shown as a note inside the open menu).
  const toggle = () => {
    setOpen(current => !current)
    if (catalog === 'ready' || catalog === 'loading') return
    setCatalog('loading')
    loadPresetCatalog()
      .then(entries => {
        setPresets(entries)
        setCatalog('ready')
      })
      .catch(() => setCatalog('failed'))
  }

  const choose = (file: string) => {
    setOpen(false)
    setPick('loading')
    const serial = ++pickSerial.current
    void loadPreset(file).then(graph => {
      if (serial !== pickSerial.current) return // a later pick superseded this one
      if (!graph) {
        setPick('failed')
        return
      }
      setPick('idle')
      onOpen(graph)
    })
  }

  const triggerLabel =
    pick === 'loading' ? t('presets.loading') : pick === 'failed' ? t('presets.failed') : t('toolbar.presets')

  return (
    <div className="add-menu" ref={rootRef}>
      <button
        type="button"
        className="btn add-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="add-menu-list" role="menu">
          {catalog === 'loading' && <span className="menu-note">{t('presets.loading')}</span>}
          {catalog === 'failed' && <span className="menu-note">{t('presets.failed')}</span>}
          {catalog === 'ready' && presets.length === 0 && <span className="menu-note">{t('presets.empty')}</span>}
          {catalog === 'ready' &&
            presets.map(entry => (
              <button
                key={entry.file}
                type="button"
                role="menuitem"
                className="add-menu-item"
                onClick={() => choose(entry.file)}
              >
                {entry[locale]}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
