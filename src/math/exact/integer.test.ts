import { describe, expect, it } from 'vitest'
import {
  bigAbs,
  bigPow,
  bitLength,
  gcd,
  integerNthRoot,
  isqrt,
  largestPrimeFactor,
  squarefreeDecompose,
} from './integer'

describe('bigAbs / gcd / bitLength', () => {
  it('takes absolute values', () => {
    expect(bigAbs(-7n)).toBe(7n)
    expect(bigAbs(7n)).toBe(7n)
    expect(bigAbs(0n)).toBe(0n)
  })

  it('computes the gcd with a non-negative result', () => {
    expect(gcd(12n, 18n)).toBe(6n)
    expect(gcd(-12n, 18n)).toBe(6n)
    expect(gcd(0n, 5n)).toBe(5n)
    expect(gcd(5n, 0n)).toBe(5n)
    expect(gcd(0n, 0n)).toBe(0n)
  })

  it('counts bits (0 for zero)', () => {
    expect(bitLength(0n)).toBe(0)
    expect(bitLength(1n)).toBe(1)
    expect(bitLength(255n)).toBe(8)
    expect(bitLength(256n)).toBe(9)
  })
})

describe('bigPow', () => {
  it('raises to non-negative powers', () => {
    expect(bigPow(2n, 10n)).toBe(1024n)
    expect(bigPow(3n, 0n)).toBe(1n)
    expect(bigPow(10n, 20n)).toBe(10n ** 20n)
  })

  it('rejects negative exponents', () => {
    expect(() => bigPow(2n, -1n)).toThrow(RangeError)
  })
})

describe('isqrt', () => {
  it('floors the square root', () => {
    expect(isqrt(0n)).toBe(0n)
    expect(isqrt(1n)).toBe(1n)
    expect(isqrt(15n)).toBe(3n)
    expect(isqrt(16n)).toBe(4n)
    expect(isqrt(17n)).toBe(4n)
  })

  it('stays exact for large values', () => {
    const root = 10n ** 10n
    expect(isqrt(root * root)).toBe(root)
    expect(isqrt(root * root + 1n)).toBe(root)
    expect(isqrt(root * root - 1n)).toBe(root - 1n)
  })

  it('rejects negative input', () => {
    expect(() => isqrt(-1n)).toThrow(RangeError)
  })
})

describe('integerNthRoot', () => {
  it('floors exact and inexact roots', () => {
    expect(integerNthRoot(27n, 3n)).toBe(3n)
    expect(integerNthRoot(26n, 3n)).toBe(2n)
    expect(integerNthRoot(16n, 4n)).toBe(2n)
    expect(integerNthRoot(81n, 4n)).toBe(3n)
    expect(integerNthRoot(1000n, 3n)).toBe(10n)
    expect(integerNthRoot(5n, 1n)).toBe(5n)
  })

  it('rejects bad arguments', () => {
    expect(() => integerNthRoot(-1n, 3n)).toThrow(RangeError)
    expect(() => integerNthRoot(8n, 0n)).toThrow(RangeError)
  })
})

describe('squarefreeDecompose', () => {
  it('splits n into square^2 * squarefree', () => {
    expect(squarefreeDecompose(1n)).toEqual({ square: 1n, squarefree: 1n })
    expect(squarefreeDecompose(2n)).toEqual({ square: 1n, squarefree: 2n })
    expect(squarefreeDecompose(4n)).toEqual({ square: 2n, squarefree: 1n })
    expect(squarefreeDecompose(8n)).toEqual({ square: 2n, squarefree: 2n })
    expect(squarefreeDecompose(12n)).toEqual({ square: 2n, squarefree: 3n })
    expect(squarefreeDecompose(36n)).toEqual({ square: 6n, squarefree: 1n })
    expect(squarefreeDecompose(72n)).toEqual({ square: 6n, squarefree: 2n })
    expect(squarefreeDecompose(180n)).toEqual({ square: 6n, squarefree: 5n })
    expect(squarefreeDecompose(30n)).toEqual({ square: 1n, squarefree: 30n })
    expect(squarefreeDecompose(900n)).toEqual({ square: 30n, squarefree: 1n })
  })

  it('rejects non-positive input', () => {
    expect(() => squarefreeDecompose(0n)).toThrow(RangeError)
  })
})

describe('largestPrimeFactor', () => {
  it('finds the largest prime factor', () => {
    expect(largestPrimeFactor(2n)).toBe(2n)
    expect(largestPrimeFactor(8n)).toBe(2n)
    expect(largestPrimeFactor(12n)).toBe(3n)
    expect(largestPrimeFactor(49n)).toBe(7n)
    expect(largestPrimeFactor(2n * 3n * 5n)).toBe(5n)
    expect(largestPrimeFactor(97n)).toBe(97n)
  })

  it('rejects values below 2', () => {
    expect(() => largestPrimeFactor(1n)).toThrow(RangeError)
  })
})
