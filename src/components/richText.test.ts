import { describe, expect, it } from 'vitest'
import { parseRichText } from './richText'

describe('parseRichText', () => {
  it('reads plain text as a single literal run', () => {
    expect(parseRichText('just words')).toEqual([{ kind: 'text', value: 'just words' }])
  })

  it('splits inline math out of the surrounding text', () => {
    expect(parseRichText('norm is $\\sqrt{2}$ exactly')).toEqual([
      { kind: 'text', value: 'norm is ' },
      { kind: 'math', value: '\\sqrt{2}' },
      { kind: 'text', value: ' exactly' },
    ])
  })

  it('keeps both sides of a note that starts and ends with math', () => {
    expect(parseRichText('$a$ and $b$')).toEqual([
      { kind: 'math', value: 'a' },
      { kind: 'text', value: ' and ' },
      { kind: 'math', value: 'b' },
    ])
  })

  it('treats an unpaired dollar as literal text', () => {
    expect(parseRichText('costs $5 today')).toEqual([{ kind: 'text', value: 'costs $5 today' }])
  })

  it('treats an escaped dollar as a literal dollar', () => {
    expect(parseRichText('\\$5 and \\$6')).toEqual([{ kind: 'text', value: '$5 and $6' }])
  })

  it('does not let an escaped dollar close a math run', () => {
    expect(parseRichText('$\\$$')).toEqual([{ kind: 'math', value: '\\$' }])
  })

  it('keeps empty input empty', () => {
    expect(parseRichText('')).toEqual([])
  })

  it('produces math only when both delimiters are present', () => {
    expect(parseRichText('$x$ then $ open')).toEqual([
      { kind: 'math', value: 'x' },
      { kind: 'text', value: ' then $ open' },
    ])
  })
})
