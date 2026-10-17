/**
 * Inline TeX in free text (the comment widget's body).
 *
 * A run delimited by unescaped `$` signs is math, everything else is literal
 * text: `the norm is $\\sqrt{2}$ exactly`. A `\$` is a literal dollar sign,
 * both inside and outside math; an opening `$` with no partner is literal too,
 * so a note can never be "half math" because of a typo.
 *
 * Pure string work on purpose — the split is easy to test and the rendering
 * (KaTeX) stays in the component (see `RichText`).
 */

export interface TextSegment {
  readonly kind: 'text'
  readonly value: string
}

export interface MathSegment {
  readonly kind: 'math'
  readonly value: string
}

export type RichSegment = TextSegment | MathSegment

/** Splits `source` into literal-text and inline-math runs. */
export function parseRichText(source: string): RichSegment[] {
  const segments: RichSegment[] = []
  let literal = ''

  const pushLiteral = () => {
    if (literal.length > 0) {
      segments.push({ kind: 'text', value: literal })
      literal = ''
    }
  }

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character === '\\' && source[index + 1] === '$') {
      literal += '$'
      index++
      continue
    }
    if (character === '$') {
      const close = closingDollar(source, index + 1)
      if (close === -1) {
        literal += character
        continue
      }
      pushLiteral()
      segments.push({ kind: 'math', value: source.slice(index + 1, close) })
      index = close
      continue
    }
    literal += character
  }

  pushLiteral()
  return segments
}

/** Index of the next unescaped `$` at or after `from`, or `-1` when there is none. */
function closingDollar(source: string, from: number): number {
  for (let index = from; index < source.length; index++) {
    if (source[index] === '\\') {
      index++
      continue
    }
    if (source[index] === '$') {
      return index
    }
  }
  return -1
}
