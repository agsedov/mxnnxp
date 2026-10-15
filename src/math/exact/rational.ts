import type { Scalar } from './scalar'
import { gcd } from './integer'

/**
 * Exact rational numbers on top of `BigInt`, the base of the exact number
 * tower.
 *
 * Normalization invariants, enforced by {@link Rational.make}:
 *  - the denominator is always positive (the sign lives in the numerator);
 *  - the fraction is fully reduced: `gcd(numerator, denominator) === 1`;
 *  - zero is always `0/1`.
 *
 * Unlike the older `Fraction` (which stores safe `number`s), the parts are
 * `BigInt`s, so there is no silent loss of precision above 2^53.
 */

const INTEGER_RE = /^[+-]?\d+$/
const DECIMAL_RE = /^[+-]?(?:\d+\.\d*|\.\d+)$/

/** Thrown when a string is not a valid exact rational literal. */
export class RationalParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RationalParseError'
  }
}

export class Rational implements Scalar<Rational> {
  readonly numerator: bigint
  readonly denominator: bigint

  private constructor(numerator: bigint, denominator: bigint) {
    this.numerator = numerator
    this.denominator = denominator
  }

  static readonly ZERO = new Rational(0n, 1n)
  static readonly ONE = new Rational(1n, 1n)

  /** Builds a normalized rational from integer parts. */
  static make(numerator: bigint, denominator: bigint = 1n): Rational {
    if (denominator === 0n) {
      throw new RangeError('Rational denominator must not be zero')
    }
    let n = numerator
    let d = denominator
    if (d < 0n) {
      n = -n
      d = -d
    }
    if (n === 0n) {
      return new Rational(0n, 1n)
    }
    const divisor = gcd(n, d)
    return new Rational(n / divisor, d / divisor)
  }

  static fromInteger(value: bigint | number): Rational {
    return Rational.make(typeof value === 'bigint' ? value : BigInt(value))
  }

  /** Parses `"42"`, `"-7"`, `"3/4"` and decimals such as `"0.25"` or `"-.5"`. */
  static parse(input: string): Rational {
    const text = input.trim()
    if (text === '') {
      throw new RationalParseError('Cannot parse an empty string as an exact rational')
    }
    if (INTEGER_RE.test(text)) {
      return Rational.make(BigInt(text.replace(/^\+/, '')))
    }
    if (DECIMAL_RE.test(text)) {
      return decimalToRational(text)
    }
    if (text.includes('/')) {
      const parts = text.split('/')
      if (parts.length !== 2) {
        throw new RationalParseError(`Cannot parse fraction: "${input}"`)
      }
      const numeratorText = parts[0].trim()
      const denominatorText = parts[1].trim()
      if (!INTEGER_RE.test(numeratorText) || !INTEGER_RE.test(denominatorText)) {
        throw new RationalParseError(`Cannot parse fraction: "${input}"`)
      }
      return Rational.make(
        BigInt(numeratorText.replace(/^\+/, '')),
        BigInt(denominatorText.replace(/^\+/, '')),
      )
    }
    throw new RationalParseError(`Cannot parse "${input}" as an exact rational`)
  }

  /** Like {@link parse}, but returns `null` instead of throwing. */
  static tryParse(input: string): Rational | null {
    try {
      return Rational.parse(input)
    } catch {
      return null
    }
  }

  add(other: Rational): Rational {
    return Rational.make(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    )
  }

  sub(other: Rational): Rational {
    return Rational.make(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    )
  }

  mul(other: Rational): Rational {
    return Rational.make(this.numerator * other.numerator, this.denominator * other.denominator)
  }

  div(other: Rational): Rational {
    if (other.isZero()) {
      throw new RangeError('Division by zero')
    }
    return Rational.make(this.numerator * other.denominator, this.denominator * other.numerator)
  }

  neg(): Rational {
    return Rational.make(-this.numerator, this.denominator)
  }

  inv(): Rational {
    if (this.isZero()) {
      throw new RangeError('Zero has no multiplicative inverse')
    }
    return Rational.make(this.denominator, this.numerator)
  }

  abs(): Rational {
    return this.numerator < 0n ? this.neg() : this
  }

  compare(other: Rational): -1 | 0 | 1 {
    // Both denominators are positive, so cross-multiplication preserves order.
    const left = this.numerator * other.denominator
    const right = other.numerator * this.denominator
    return left < right ? -1 : left > right ? 1 : 0
  }

  equals(other: Rational): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator
  }

  sign(): -1 | 0 | 1 {
    return this.numerator < 0n ? -1 : this.numerator > 0n ? 1 : 0
  }

  isZero(): boolean {
    return this.numerator === 0n
  }

  isInteger(): boolean {
    return this.denominator === 1n
  }

  isNegative(): boolean {
    return this.numerator < 0n
  }

  toString(): string {
    return this.denominator === 1n
      ? this.numerator.toString()
      : `${this.numerator.toString()}/${this.denominator.toString()}`
  }

  toLatex(): string {
    if (this.denominator === 1n) {
      return this.numerator.toString()
    }
    const sign = this.numerator < 0n ? '-' : ''
    const magnitude = this.numerator < 0n ? -this.numerator : this.numerator
    return `${sign}\\frac{${magnitude.toString()}}{${this.denominator.toString()}}`
  }

  /** Approximate value for display/ordering hints only — never a computed value. */
  toNumber(): number {
    return Number(this.numerator) / Number(this.denominator)
  }
}

function decimalToRational(text: string): Rational {
  const negative = text.startsWith('-')
  const unsigned = text.replace(/^[+-]/, '')
  const dot = unsigned.indexOf('.')
  const integerPart = dot === -1 ? unsigned : unsigned.slice(0, dot)
  const fractionPart = dot === -1 ? '' : unsigned.slice(dot + 1)
  const digits = `${integerPart === '' ? '0' : integerPart}${fractionPart}`
  const numerator = BigInt(digits)
  const denominator = 10n ** BigInt(fractionPart.length)
  return Rational.make(negative ? -numerator : numerator, denominator)
}
