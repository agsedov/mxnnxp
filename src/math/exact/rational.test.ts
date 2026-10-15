import { describe, expect, it } from 'vitest'
import { Rational, RationalParseError } from './rational'

describe('Rational construction', () => {
  it('reduces to lowest terms', () => {
    const value = Rational.make(6n, 8n)
    expect(value.numerator).toBe(3n)
    expect(value.denominator).toBe(4n)
  })

  it('keeps the sign in the numerator', () => {
    const value = Rational.make(3n, -4n)
    expect(value.numerator).toBe(-3n)
    expect(value.denominator).toBe(4n)
  })

  it('normalizes zero', () => {
    expect(Rational.make(0n, -7n).toString()).toBe('0')
    expect(Rational.make(0n, -7n).isZero()).toBe(true)
  })

  it('rejects a zero denominator', () => {
    expect(() => Rational.make(1n, 0n)).toThrow(RangeError)
  })
})

describe('Rational parsing', () => {
  it('parses integers, fractions and decimals exactly', () => {
    expect(Rational.parse('42').toString()).toBe('42')
    expect(Rational.parse('-7').toString()).toBe('-7')
    expect(Rational.parse('6/8').toString()).toBe('3/4')
    expect(Rational.parse(' 1 / 2 ').toString()).toBe('1/2')
    expect(Rational.parse('0.25').toString()).toBe('1/4')
    expect(Rational.parse('-.5').toString()).toBe('-1/2')
    expect(Rational.parse('2.').toString()).toBe('2')
  })

  it('rejects garbage', () => {
    expect(() => Rational.parse('')).toThrow(RationalParseError)
    expect(() => Rational.parse('abc')).toThrow(RationalParseError)
    expect(() => Rational.parse('1/2/3')).toThrow(RationalParseError)
    expect(Rational.tryParse('nope')).toBeNull()
  })
})

describe('Rational arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(Rational.parse('1/2').add(Rational.parse('1/3')).toString()).toBe('5/6')
    expect(Rational.parse('1/2').sub(Rational.parse('1/3')).toString()).toBe('1/6')
  })

  it('multiplies and divides exactly', () => {
    expect(Rational.parse('2/3').mul(Rational.parse('3/4')).toString()).toBe('1/2')
    expect(Rational.parse('1/2').div(Rational.parse('1/4')).toString()).toBe('2')
  })

  it('rejects division by zero and inverting zero', () => {
    expect(() => Rational.parse('1/2').div(Rational.ZERO)).toThrow(RangeError)
    expect(() => Rational.ZERO.inv()).toThrow(RangeError)
  })

  it('supports neg, inv, abs and compare', () => {
    expect(Rational.parse('3/4').neg().toString()).toBe('-3/4')
    expect(Rational.parse('3/4').inv().toString()).toBe('4/3')
    expect(Rational.parse('-3/4').abs().toString()).toBe('3/4')
    expect(Rational.parse('1/3').compare(Rational.parse('1/2'))).toBe(-1)
    expect(Rational.parse('1/2').compare(Rational.parse('2/4'))).toBe(0)
    expect(Rational.parse('3/4').sign()).toBe(1)
    expect(Rational.ZERO.sign()).toBe(0)
  })

  it('avoids floating point drift (0.1 + 0.2 === 0.3)', () => {
    const sum = Rational.parse('0.1').add(Rational.parse('0.2'))
    expect(sum.equals(Rational.parse('0.3'))).toBe(true)
    expect(sum.toString()).toBe('3/10')
  })

  it('is exact far beyond 2^53', () => {
    const big = 2n ** 60n + 1n
    const value = Rational.make(big)
    expect(value.add(Rational.ONE).toString()).toBe((big + 1n).toString())
    expect(Rational.make(big, 3n).mul(Rational.make(3n)).equals(value)).toBe(true)
    expect(Rational.make(big).div(Rational.make(big)).equals(Rational.ONE)).toBe(true)
  })
})

describe('Rational LaTeX', () => {
  it('renders integers bare and other values as \\frac', () => {
    expect(Rational.parse('3').toLatex()).toBe('3')
    expect(Rational.parse('3/4').toLatex()).toBe('\\frac{3}{4}')
    expect(Rational.parse('-3/4').toLatex()).toBe('-\\frac{3}{4}')
    expect(Rational.ZERO.toLatex()).toBe('0')
  })
})
