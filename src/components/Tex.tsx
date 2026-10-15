import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useMemo, useState } from 'react'

/**
 * Development escape hatch. When true, every `Tex` instance keeps showing the
 * first value it ever rendered and ignores later updates.
 *
 * Policy (see "TeX rendering" in docs/requirements.md): if the TeX update cycle
 * misbehaves — stale formulas, flicker, remount storms, values that stop
 * following their input — the fix is to *temporarily stop updating* (flip this
 * on) and move on with the feature, instead of debugging the renderer in the
 * middle of something else. Keep it `false` unless a problem actually shows up.
 */
export const FREEZE_TEX_UPDATES = false

/** KaTeX options for value displays: centred, never throwing, with MathML. */
const KATEX_OPTIONS = {
  displayMode: true,
  throwOnError: false,
  output: 'htmlAndMathml',
} as const

/**
 * Renders a LaTeX string (a matrix, a value) with KaTeX.
 *
 * KaTeX is synchronous — `renderToString` returns finished HTML, with no
 * queued typesetting pass — which is exactly why it is used here: there is no
 * asynchronous update cycle to keep in sync with React. The MathML output also
 * carries the LaTeX source, which is handy for tests and screen readers.
 */
export function Tex({ latex }: { latex: string }) {
  const html = useMemo(() => katex.renderToString(latex, KATEX_OPTIONS), [latex])
  // Freezing is "the first render wins": with the flag on, later values are
  // simply dropped instead of being typeset again.
  const [frozen] = useState(html)
  return <div className="tex" dangerouslySetInnerHTML={{ __html: FREEZE_TEX_UPDATES ? frozen : html }} />
}
