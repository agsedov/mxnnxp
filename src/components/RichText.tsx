import { Fragment } from 'react'
import { Tex } from './Tex'
import { parseRichText } from './richText'

/**
 * Renders free text with inline TeX: `$…$` runs are typeset by KaTeX, the rest
 * is shown verbatim. Whitespace (newlines, runs of spaces) is preserved by the
 * container's `white-space: pre-wrap` (see `.comment-text` in `index.css`).
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((segment, index) =>
        segment.kind === 'math' ? (
          <Tex key={index} latex={segment.value} inline />
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        ),
      )}
    </>
  )
}
