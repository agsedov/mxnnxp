import { tryDeserializeGraph } from './graph/serialize'
import type { Graph } from './graph/types'

/**
 * Preset plumbing: ready-made scenes served as plain static files, so any dumb
 * file server (the deploy target is Apache) can host them.
 *
 * Two artifacts, both under `/presets/`:
 *
 * - `presets/index.json` — the catalog: which presets exist and what they are
 *   called in each language.
 * - `presets/<file>` — one file per preset, carrying the scene in exactly the
 *   format a `#g=` link carries (see `src/graph/serialize.ts`), so loading a
 *   preset is the same decode as opening a shared link.
 *
 * Both are fetched lazily (catalog on the first dropdown open, a preset when
 * its entry is picked) — nothing preset-related is in the initial bundle.
 */

/** One catalog entry: the static file to load, plus its name per language. */
export interface PresetEntry {
  file: string
  en: string
  ru: string
}

/** URL prefix all preset files live under; respects Vite's configured base. */
const PRESETS_BASE = `${import.meta.env.BASE_URL}presets`

/**
 * Preset files are fetched by name, so a name from a hand-edited catalog must
 * never be able to address anything outside `/presets/`: no slashes, no
 * leading dots (so not `..`), and the name must start with a letter or digit.
 */
const PRESET_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

/**
 * Reads the preset catalog (`presets/index.json`).
 *
 * Throws on a network failure; a file that exists but is not a well-formed
 * catalog parses as an empty list (`parsePresetCatalog`), so a hand-editing
 * slip degrades to "no presets" rather than an error state.
 */
export async function loadPresetCatalog(): Promise<PresetEntry[]> {
  const response = await fetch(`${PRESETS_BASE}/index.json`)
  if (!response.ok) throw new Error(`Preset catalog responded ${response.status}`)
  return parsePresetCatalog(await response.text())
}

/**
 * Parses the catalog's JSON leniently: entries with an unsafe file name or
 * missing names are skipped, so one bad line cannot take the whole menu down.
 */
export function parsePresetCatalog(text: string): PresetEntry[] {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []
  const entries: PresetEntry[] = []
  for (const item of value) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
    const { file, en, ru } = item as Record<string, unknown>
    if (typeof file !== 'string' || !PRESET_FILE_NAME.test(file)) continue
    if (typeof en !== 'string' || typeof ru !== 'string') continue
    entries.push({ file, en, ru })
  }
  return entries
}

/**
 * Fetches and decodes one preset file: the same payload a `#g=` link carries.
 *
 * Returns `null` — rather than throwing — for anything unpickable: a bad name,
 * a missing file, a payload the decoder rejects. Callers treat all of those
 * the same way: the canvas stays as it is.
 */
export async function loadPreset(file: string): Promise<Graph | null> {
  if (!PRESET_FILE_NAME.test(file)) return null
  try {
    const response = await fetch(`${PRESETS_BASE}/${file}`)
    if (!response.ok) return null
    return await tryDeserializeGraph((await response.text()).trim())
  } catch {
    return null
  }
}

/**
 * Reads a preset file name from a URL search string (`location.search`).
 * Accepts `preset=` or `p=`; returns the file name only if it passes the same
 * safety check as preset loading (no `..`, no path separators). Returns `null`
 * when not present or invalid.
 */
export function presetFileFromSearch(search: string): string | null {
  if (!search) return null
  const params = new URLSearchParams(search)
  const file = params.get('preset') ?? params.get('p')
  if (typeof file !== 'string' || file.length === 0) return null
  return PRESET_FILE_NAME.test(file) ? file : null
}
