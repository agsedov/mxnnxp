import { describe, expect, it } from 'vitest'
import { ExactParseError, parseExact, tryParseExact } from './parse'

function canonical(text: string): string {
  return parseExact(text).toString()
}

describe('parseExact — rationals', () => {
  it('parses integers, fractions and decimals exactly', () => {
    expect(canonical('3/4')).toBe('3/4')
    expect(canonical('-7')).toBe('-7')
    expect(canonical('0.25')).toBe('1/4')
    expect(canonical('1.5 * 2')).toBe('3')
    expect(canonical(' 1 / 2 ')).toBe('1/2')
  })

  it('treats "/" as division, not as a separate fraction token', () => {
    expect(canonical('6/8')).toBe('3/4')
    expect(canonical('(1/2)/(3/4)')).toBe('2/3')
  })
})

describe('parseExact — radicals', () => {
  it('accepts sqrt(...), bare sqrt, unicode and LaTeX spellings', () => {
    expect(canonical('sqrt(2)')).toBe('sqrt(2)')
    expect(canonical('sqrt 2')).toBe('sqrt(2)')
    expect(canonical('\u221a2')).toBe('sqrt(2)')
    expect(canonical('\\sqrt{2}')).toBe('sqrt(2)')
    expect(canonical('sqrt(2)/2')).toBe('sqrt(2)/2')
    expect(canonical('\\sqrt{2}/2')).toBe('sqrt(2)/2')
    expect(canonical('2sqrt(2)')).toBe('2*sqrt(2)')
    expect(canonical('2*sqrt(2)')).toBe('2*sqrt(2)')
  })

  it('normalizes products and quotients of radicals', () => {
    expect(canonical('\u221a2\u00b7\u221a3')).toBe('sqrt(6)')
    expect(canonical('sqrt(8)')).toBe('2*sqrt(2)')
    expect(canonical('(1+sqrt(5))/2')).toBe('1/2 + sqrt(5)/2')
    expect(canonical('\\frac{1}{2}')).toBe('1/2')
  })

  it('accepts powers and roots', () => {
    expect(canonical('sqrt(2)^2')).toBe('2')
    expect(canonical('2^0.5')).toBe('sqrt(2)')
    expect(canonical('8^(1/3)')).toBe('2')
    expect(canonical('2^-1')).toBe('1/2')
    expect(canonical('(1+sqrt(5))*(1-sqrt(5))')).toBe('-4')
  })
})

describe('parseExact — complex', () => {
  it('parses the imaginary unit', () => {
    expect(canonical('i')).toBe('i')
    expect(canonical('2i')).toBe('2*i')
    expect(canonical('1-i')).toBe('1 - i')
    expect(canonical('1+2i')).toBe('1 + 2*i')
    expect(canonical('sqrt(-4)')).toBe('2*i')
    expect(canonical('(1+sqrt(2))*i')).toBe('(1 + sqrt(2))*i')
  })
})

describe('parseExact — round trip', () => {
  it('re-parses its own canonical output', () => {
    const sources = [
      '0',
      '-3/4',
      'sqrt(2)/2',
      '2*sqrt(2)',
      '1 + sqrt(2)',
      '-1 + sqrt(2)',
      '1/2 + sqrt(5)/2',
      '3 - 2*sqrt(2)',
      'i',
      '-i',
      '1 - i',
      '2*i',
      '(1 + sqrt(2))*i',
    ]
    for (const source of sources) {
      const value = parseExact(source)
      expect(value.toString()).toBe(source)
      expect(parseExact(value.toString()).equals(value)).toBe(true)
    }
  })
})

describe('parseExact — errors', () => {
  it('reports malformed input', () => {
    const bad = ['', 'abc', '1 2', 'sqrt(', '()', '2^sqrt(2)', 'sqrt(sqrt(2))', '1/0', '1..2', '\\pi']
    for (const source of bad) {
      expect(() => parseExact(source)).toThrow(ExactParseError)
      expect(tryParseExact(source)).toBeNull()
    }
  })

  it('does not treat a bare number sequence as implicit multiplication', () => {
    expect(() => parseExact('1 2')).toThrow(ExactParseError)
  })
})
