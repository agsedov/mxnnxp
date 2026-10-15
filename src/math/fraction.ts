/**
 * Exact rational numbers ("fractions"), modeled after Python's `fractions.Fraction`.
 *
 * Normalization invariants, enforced by `Fraction.make`:
 *  - numerator and denominator are safe integers;
 *  - the denominator is always positive (the sign lives in the numerator);
 *  - the fraction is fully reduced: gcd(numerator, denominator) === 1.
 *
 * Because of the invariants, two fractions are equal if and only if their
 * components are pairwise identical, and all arithmetic is exact — no IEEE
 * floating point ever touches a value in the math layer.
 */

/** Greatest common divisor of two non-negative integers. */
function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b !== 0) {
    const rest = a % b
    a = b
    b = rest
  }
  return a
}

const INTEGER_RE = /^[+-]?\d+$/
const DECIMAL_RE = /^[+-]?(?:\d+\.\d*|\.\d+)$/

export class FractionParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FractionParseError'
  }
}

export class Fraction {
  readonly numerator: number
  readonly denominator: number

  private constructor(numerator: number, denominator: number) {
    this.numerator = numerator
    this.denominator = denominator
  }

  /** Builds a normalized fraction from integer parts. */
  static make(numerator: number, denominator = 1): Fraction {
    if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
      throw new RangeError(`Fraction parts must be safe integers, got ${numerator}/${denominator}`)
    }
    if (denominator === 0) {
      throw new RangeError('Fraction denominator must not be zero')
    }
    let n = numerator
    let d = denominator
    if (d < 0) {
      n = -n
      d = -d
    }
    if (n === 0) {
      return new Fraction(0, 1)
    }
    const g = gcd(n, d)
    return new Fraction(n / g, d / g)
  }

  static readonly ZERO = Fraction.make(0)
  static readonly ONE = Fraction.make(1)

  /**
   * Parses "42", "-7", "3/4" and decimal strings such as "0.25" or "-.5".
   * Throws {@link FractionParseError} for anything else.
   */
  static parse(input: string): Fraction {
    const text = input.trim()
    if (text === '') {
      throw new FractionParseError('Cannot parse an empty string as a fraction')
    }
    if (text.includes('/')) {
      const parts = text.split('/')
      if (parts.length !== 2) {
        throw new FractionParseError(`Cannot parse fraction: "${input}"`)
      }
      const [numeratorText, denominatorText] = parts
      return Fraction.make(parseInteger(numeratorText, input), parseInteger(denominatorText, input))
    }
    if (INTEGER_RE.test(text)) {
      return Fraction.make(parseInt(text, 10), 1)
    }
    if (DECIMAL_RE.test(text)) {
      return fractionFromDecimal(text)
    }
    throw new FractionParseError(`Cannot parse fraction: "${input}"`)
  }

  /** Like {@link parse}, but returns null instead of throwing. */
  static tryParse(input: string): Fraction | null {
    try {
      return Fraction.parse(input)
    } catch {
      return null
    }
  }

  /** Converts a JS number; non-integers are read through their decimal string form. */
  static fromNumber(value: number): Fraction {
    if (!Number.isFinite(value)) {
      throw new RangeError(`Cannot convert ${value} to a Fraction`)
    }
    return Fraction.parse(String(value))
  }

  add(other: Fraction): Fraction {
    return Fraction.make(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    )
  }

  sub(other: Fraction): Fraction {
    return Fraction.make(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    )
  }

  mul(other: Fraction): Fraction {
    return Fraction.make(this.numerator * other.numerator, this.denominator * other.denominator)
  }

  div(other: Fraction): Fraction {
    if (other.numerator === 0) {
      throw new RangeError('Division by zero')
    }
    return Fraction.make(this.numerator * other.denominator, this.denominator * other.numerator)
  }

  neg(): Fraction {
    return Fraction.make(-this.numerator, this.denominator)
  }

  inv(): Fraction {
    if (this.numerator === 0) {
      throw new RangeError('Zero has no multiplicative inverse')
    }
    return Fraction.make(this.denominator, this.numerator)
  }

  abs(): Fraction {
    return this.numerator < 0 ? this.neg() : this
  }

  compare(other: Fraction): -1 | 0 | 1 {
    const difference = this.sub(other)
    return difference.numerator < 0 ? -1 : difference.numerator > 0 ? 1 : 0
  }

  /** Exact equality — safe because both fractions are normalized. */
  equals(other: Fraction): boolean {
    return this.numerator === other.numerator && this.denominator === other.denominator
  }

  get isZero(): boolean {
    return this.numerator === 0
  }

  get isInteger(): boolean {
    return this.denominator === 1
  }

  get isNegative(): boolean {
    return this.numerator < 0
  }

  toString(): string {
    return this.denominator === 1 ? String(this.numerator) : `${this.numerator}/${this.denominator}`
  }

  toNumber(): number {
    return this.numerator / this.denominator
  }
}

function parseInteger(text: string, original: string): number {
  const trimmed = text.trim()
  if (!INTEGER_RE.test(trimmed)) {
    throw new FractionParseError(`Cannot parse fraction: "${original}"`)
  }
  const value = parseInt(trimmed, 10)
  if (!Number.isSafeInteger(value)) {
    throw new FractionParseError(`Fraction part out of safe integer range in "${original}"`)
  }
  return value
}

function fractionFromDecimal(text: string): Fraction {
  const negative = text.startsWith('-')
  const unsigned = text.startsWith('-') || text.startsWith('+') ? text.slice(1) : text
  const [integerPart = '0', fractionalPart = ''] = unsigned.split('.')
  const digits = `${integerPart || '0'}${fractionalPart}`
  const denominator = 10 ** fractionalPart.length
  const numerator = parseInt(digits, 10) * (negative ? -1 : 1)
  return Fraction.make(numerator, denominator)
}
