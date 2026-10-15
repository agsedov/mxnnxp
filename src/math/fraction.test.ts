import { describe, expect, it } from 'vitest'
import { Fraction, FractionParseError } from './fraction'

describe('Fraction construction', () => {
  it('reduces to lowest terms', () => {
    const value = Fraction.make(6, 8)
    expect(value.numerator).toBe(3)
    expect(value.denominator).toBe(4)
  })

  it('keeps the sign in the numerator', () => {
    const value = Fraction.make(3, -4)
    expect(value.numerator).toBe(-3)
    expect(value.denominator).toBe(4)
  })

  it('normalizes zero', () => {
    const value = Fraction.make(0, -7)
    expect(value.toString()).toBe('0')
    expect(value.isZero).toBe(true)
  })

  it('rejects a zero denominator', () => {
    expect(() => Fraction.make(1, 0)).toThrow(RangeError)
  })

  it('rejects non-integer parts', () => {
    expect(() => Fraction.make(1.5, 2)).toThrow(RangeError)
  })
})

describe('Fraction parsing', () => {
  it('parses integers', () => {
    expect(Fraction.parse('42').toString()).toBe('42')
    expect(Fraction.parse('-7').toString()).toBe('-7')
  })

  it('parses a/b and reduces', () => {
    expect(Fraction.parse('6/8').toString()).toBe('3/4')
    expect(Fraction.parse(' 1 / 2 ').toString()).toBe('1/2')
  })

  it('parses decimals exactly', () => {
    expect(Fraction.parse('0.25').toString()).toBe('1/4')
    expect(Fraction.parse('-.5').toString()).toBe('-1/2')
    expect(Fraction.parse('2.').toString()).toBe('2')
  })

  it('rejects garbage', () => {
    expect(() => Fraction.parse('abc')).toThrow(FractionParseError)
    expect(() => Fraction.parse('1/2/3')).toThrow(FractionParseError)
    expect(() => Fraction.parse('')).toThrow(FractionParseError)
    expect(Fraction.tryParse('nope')).toBeNull()
  })
})

describe('Fraction arithmetic', () => {
  it('adds and subtracts exactly', () => {
    expect(Fraction.parse('1/2').add(Fraction.parse('1/3')).toString()).toBe('5/6')
    expect(Fraction.parse('1/2').sub(Fraction.parse('1/3')).toString()).toBe('1/6')
  })

  it('multiplies and divides exactly', () => {
    expect(Fraction.parse('2/3').mul(Fraction.parse('3/4')).toString()).toBe('1/2')
    expect(Fraction.parse('1/2').div(Fraction.parse('1/4')).toString()).toBe('2')
  })

  it('rejects division by zero and inverting zero', () => {
    expect(() => Fraction.parse('1/2').div(Fraction.ZERO)).toThrow(RangeError)
    expect(() => Fraction.ZERO.inv()).toThrow(RangeError)
  })

  it('supports neg, inv, abs, compare', () => {
    expect(Fraction.parse('3/4').neg().toString()).toBe('-3/4')
    expect(Fraction.parse('3/4').inv().toString()).toBe('4/3')
    expect(Fraction.parse('-3/4').abs().toString()).toBe('3/4')
    expect(Fraction.parse('1/3').compare(Fraction.parse('1/2'))).toBe(-1)
    expect(Fraction.parse('1/2').compare(Fraction.parse('2/4'))).toBe(0)
  })

  it('avoids floating point drift (0.1 + 0.2 === 0.3)', () => {
    const sum = Fraction.fromNumber(0.1).add(Fraction.fromNumber(0.2))
    expect(sum.equals(Fraction.fromNumber(0.3))).toBe(true)
    expect(sum.toString()).toBe('3/10')
  })
})
