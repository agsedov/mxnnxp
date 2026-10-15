import { bigPow, integerNthRoot, isqrt, largestPrimeFactor, squarefreeDecompose } from './integer'
import { Rational } from './rational'
import type { Scalar } from './scalar'

/**
 * Exact complex algebraic numbers built from rationals and square roots.
 *
 * A value lives in a multiquadratic field `Q(sqrt(d1), ..., sqrt(dk))` and is
 * stored in canonical form as two maps — the real and imaginary parts — from a
 * **positive square-free BigInt radicand** to a `Rational` coefficient:
 *
 *     1 + sqrt(2)  <->  re: { 1: 1, 2: 1 },  im: {}
 *     i * sqrt(2)  <->  re: {},            im: { 2: 1 }
 *     sqrt(2) / 2  <->  re: { 2: 1/2 },    im: {}
 *
 * Canonical form makes equality structural, drops the need for a floating
 * point fallback and keeps every operation exact. Because there are no radical
 * denominators left after normalization, rationalization is automatic:
 * `1 / sqrt(2)` normalizes to `sqrt(2) / 2`.
 *
 * `i` is represented as the imaginary coefficient of radicand 1, so complex
 * numbers cost nothing extra (`sqrt(-2)` is `im: { 2: 1 }`).
 *
 * Ordering (`sign`, `compare`) is only defined for real values and is decided
 * by exact rational interval arithmetic that refines until zero is excluded.
 */

/** Largest precision (in bits) the sign/compare routine will try. */
const MAX_SIGN_BITS = 4096

/** Thrown when an operation leaves the exactly representable tower. */
export class AlgebraicError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AlgebraicError'
  }
}

/** Canonical real or imaginary part: square-free radicand -> non-zero rational. */
type Terms = ReadonlyMap<bigint, Rational>

export class Algebraic implements Scalar<Algebraic> {
  readonly re: ReadonlyMap<bigint, Rational>
  readonly im: ReadonlyMap<bigint, Rational>

  private constructor(real: Terms, imaginary: Terms) {
    this.re = real
    this.im = imaginary
  }

  static readonly ZERO = new Algebraic(new Map(), new Map())
  static readonly ONE = new Algebraic(new Map([[1n, Rational.ONE]]), new Map())
  static readonly I = new Algebraic(new Map(), new Map([[1n, Rational.ONE]]))

  /** Builds a value from raw (possibly reducible) terms and normalizes it. */
  static make(
    real: Iterable<readonly [bigint, Rational]>,
    imaginary: Iterable<readonly [bigint, Rational]> = [],
  ): Algebraic {
    return new Algebraic(normalize(real), normalize(imaginary))
  }

  static fromRational(value: Rational): Algebraic {
    return value.isZero() ? Algebraic.ZERO : new Algebraic(new Map([[1n, value]]), new Map())
  }

  static fromInteger(value: bigint | number): Algebraic {
    return Algebraic.fromRational(Rational.fromInteger(value))
  }

  /** Exact square root of a rational: the entry point for `sqrt(2)`, `i`, ... */
  static sqrt(value: Rational): Algebraic {
    if (value.isZero()) {
      return Algebraic.ZERO
    }
    if (value.isNegative()) {
      return Algebraic.I.mul(Algebraic.sqrt(value.neg()))
    }
    const product = value.numerator * value.denominator
    const { square, squarefree } = squarefreeDecompose(product)
    return Algebraic.make([[squarefree, Rational.make(square, value.denominator)]])
  }

  add(other: Algebraic): Algebraic {
    return new Algebraic(addTerms(this.re, other.re), addTerms(this.im, other.im))
  }

  sub(other: Algebraic): Algebraic {
    return new Algebraic(addTerms(this.re, negTerms(other.re)), addTerms(this.im, negTerms(other.im)))
  }

  mul(other: Algebraic): Algebraic {
    const realReal = mulTerms(this.re, other.re)
    const imagImag = mulTerms(this.im, other.im)
    const realImag = mulTerms(this.re, other.im)
    const imagReal = mulTerms(this.im, other.re)
    return new Algebraic(addTerms(realReal, negTerms(imagImag)), addTerms(realImag, imagReal))
  }

  neg(): Algebraic {
    return new Algebraic(negTerms(this.re), negTerms(this.im))
  }

  inv(): Algebraic {
    const norm = addTerms(mulTerms(this.re, this.re), mulTerms(this.im, this.im))
    const inverseNorm = invertTerms(norm)
    return new Algebraic(mulTerms(this.re, inverseNorm), negTerms(mulTerms(this.im, inverseNorm)))
  }

  div(other: Algebraic): Algebraic {
    return this.mul(other.inv())
  }

  conjugate(): Algebraic {
    return new Algebraic(new Map(this.re), negTerms(this.im))
  }

  /** Integer or rational exponent; irrational exponents are rejected. */
  pow(exponent: Algebraic): Algebraic {
    if (exponent.isInteger()) {
      return this.powInteger(exponent.toRational().numerator)
    }
    if (exponent.isRational()) {
      const rational = exponent.toRational()
      return this.powInteger(rational.numerator).nthRoot(rational.denominator)
    }
    throw new AlgebraicError('Exponents must be rational')
  }

  /** Exact `degree`-th root, or an error when it leaves the tower. */
  nthRoot(degree: bigint): Algebraic {
    if (degree < 1n) {
      throw new AlgebraicError(`Root degree must be positive, got ${degree}`)
    }
    if (degree === 1n) {
      return this
    }
    if (degree === 2n) {
      if (!this.isRational()) {
        throw new AlgebraicError('This square root is not representable exactly')
      }
      return Algebraic.sqrt(this.toRational())
    }
    if (!this.isRational()) {
      throw new AlgebraicError(`This ${degree}-th root is not representable exactly`)
    }
    const value = this.toRational()
    if (value.isZero()) {
      return Algebraic.ZERO
    }
    if (value.isNegative()) {
      if (degree % 2n === 0n) {
        throw new AlgebraicError('An even root of a negative number is not real')
      }
      return this.neg().nthRoot(degree).neg()
    }
    const rootNumerator = integerNthRoot(value.numerator, degree)
    const rootDenominator = integerNthRoot(value.denominator, degree)
    if (
      bigPow(rootNumerator, degree) === value.numerator &&
      bigPow(rootDenominator, degree) === value.denominator
    ) {
      return Algebraic.fromRational(Rational.make(rootNumerator, rootDenominator))
    }
    throw new AlgebraicError(`This ${degree}-th root is not representable exactly`)
  }

  private powInteger(exponent: bigint): Algebraic {
    if (exponent === 0n) {
      return Algebraic.ONE
    }
    if (exponent < 0n) {
      return this.inv().powInteger(-exponent)
    }
    return powerOf(this, exponent)
  }

  equals(other: Algebraic): boolean {
    return termsEqual(this.re, other.re) && termsEqual(this.im, other.im)
  }

  isZero(): boolean {
    return this.re.size === 0 && this.im.size === 0
  }

  isReal(): boolean {
    return this.im.size === 0
  }

  isRational(): boolean {
    return this.isReal() && (this.re.size === 0 || (this.re.size === 1 && this.re.has(1n)))
  }

  isInteger(): boolean {
    return this.isRational() && this.toRational().isInteger()
  }

  toRational(): Rational {
    if (!this.isRational()) {
      throw new AlgebraicError(`Expected a rational value, got ${this.toString()}`)
    }
    return this.re.get(1n) ?? Rational.ZERO
  }

  sign(): -1 | 0 | 1 {
    if (!this.isReal()) {
      throw new AlgebraicError('Complex numbers have no ordering')
    }
    return signOfTerms(this.re)
  }

  compare(other: Algebraic): -1 | 0 | 1 {
    if (!this.isReal() || !other.isReal()) {
      throw new AlgebraicError('Complex numbers have no ordering')
    }
    return signOfTerms(addTerms(this.re, negTerms(other.re)))
  }

  abs(): Algebraic {
    const sign = this.sign()
    return sign < 0 ? this.neg() : this
  }

  realPart(): Algebraic {
    return new Algebraic(new Map(this.re), new Map())
  }

  imagPart(): Algebraic {
    return new Algebraic(new Map(), new Map(this.im))
  }

  toString(): string {
    if (this.im.size === 0) {
      return formatTerms(this.re, 'sqrt')
    }
    const single = singleEntry(this.im)
    if (single) {
      const body = formatImaginaryUnit(single[0], single[1].abs(), 'sqrt')
      if (this.re.size === 0) {
        return single[1].isNegative() ? `-${body}` : body
      }
      return `${formatTerms(this.re, 'sqrt')} ${single[1].isNegative() ? '-' : '+'} ${body}`
    }
    const body = formatImaginarySum(this.im, 'sqrt')
    return this.re.size === 0 ? body : `${formatTerms(this.re, 'sqrt')} + ${body}`
  }

  toLatex(): string {
    if (this.im.size === 0) {
      return formatTerms(this.re, 'latex')
    }
    const single = singleEntry(this.im)
    if (single) {
      const body = formatImaginaryUnit(single[0], single[1].abs(), 'latex')
      if (this.re.size === 0) {
        return single[1].isNegative() ? `-${body}` : body
      }
      return `${formatTerms(this.re, 'latex')} ${single[1].isNegative() ? '-' : '+'} ${body}`
    }
    const body = formatImaginarySum(this.im, 'latex')
    return this.re.size === 0 ? body : `${formatTerms(this.re, 'latex')} + ${body}`
  }

  /** Approximate value for display/ordering hints only — never a computed value. */
  toNumber(): number {
    if (!this.isReal()) {
      throw new AlgebraicError('Cannot approximate a non-real value as a single number')
    }
    let total = 0
    for (const [radicand, coefficient] of this.re) {
      total += coefficient.toNumber() * (radicand === 1n ? 1 : Math.sqrt(Number(radicand)))
    }
    return total
  }
}

function powerOf(base: Algebraic, exponent: bigint): Algebraic {
  let result = Algebraic.ONE
  let factor = base
  let power = exponent
  while (power > 0n) {
    if (power & 1n) {
      result = result.mul(factor)
    }
    power >>= 1n
    if (power > 0n) {
      factor = factor.mul(factor)
    }
  }
  return result
}

function normalize(terms: Iterable<readonly [bigint, Rational]>): Map<bigint, Rational> {
  const result: Map<bigint, Rational> = new Map()
  for (const [radicand, coefficient] of terms) {
    if (radicand < 1n) {
      throw new RangeError(`Radicand must be a positive integer, got ${radicand}`)
    }
    if (coefficient.isZero()) {
      continue
    }
    const { square, squarefree } = squarefreeDecompose(radicand)
    accumulate(result, squarefree, coefficient.mul(Rational.make(square)))
  }
  return result
}

function accumulate(terms: Map<bigint, Rational>, radicand: bigint, delta: Rational): void {
  const next = (terms.get(radicand) ?? Rational.ZERO).add(delta)
  if (next.isZero()) {
    terms.delete(radicand)
  } else {
    terms.set(radicand, next)
  }
}

function addTerms(a: Terms, b: Terms): Map<bigint, Rational> {
  const result: Map<bigint, Rational> = new Map(a)
  for (const [radicand, coefficient] of b) {
    accumulate(result, radicand, coefficient)
  }
  return result
}

function negTerms(a: Terms): Map<bigint, Rational> {
  const result: Map<bigint, Rational> = new Map()
  for (const [radicand, coefficient] of a) {
    result.set(radicand, coefficient.neg())
  }
  return result
}

function scaleTerms(a: Terms, factor: Rational): Map<bigint, Rational> {
  if (factor.isZero()) {
    return new Map()
  }
  const result: Map<bigint, Rational> = new Map()
  for (const [radicand, coefficient] of a) {
    result.set(radicand, coefficient.mul(factor))
  }
  return result
}

function mulTerms(a: Terms, b: Terms): Map<bigint, Rational> {
  const result: Map<bigint, Rational> = new Map()
  for (const [leftRadicand, leftCoefficient] of a) {
    for (const [rightRadicand, rightCoefficient] of b) {
      const { square, squarefree } = squarefreeDecompose(leftRadicand * rightRadicand)
      accumulate(result, squarefree, leftCoefficient.mul(rightCoefficient).mul(Rational.make(square)))
    }
  }
  return result
}

/**
 * Multiplicative inverse of a real multiquadratic value by the field-tower
 * identity `1/(A + B*sqrt(p)) = (A - B*sqrt(p)) / (A^2 - B^2 p)`, recursing on
 * the subfield that excludes the largest prime `p`. No linear algebra or
 * floating point involved.
 */
function invertTerms(value: Terms): Map<bigint, Rational> {
  if (value.size === 0) {
    throw new RangeError('Zero has no multiplicative inverse')
  }
  const prime = largestPrimeAmongKeys(value)
  if (prime === null) {
    const rational = value.get(1n)
    if (!rational) {
      throw new AlgebraicError('Malformed exact number')
    }
    return new Map([[1n, rational.inv()]])
  }
  const rationalPart: Map<bigint, Rational> = new Map()
  const radicalPart: Map<bigint, Rational> = new Map()
  for (const [radicand, coefficient] of value) {
    if (radicand % prime === 0n) {
      radicalPart.set(radicand / prime, coefficient)
    } else {
      rationalPart.set(radicand, coefficient)
    }
  }
  const norm = addTerms(
    mulTerms(rationalPart, rationalPart),
    negTerms(scaleTerms(mulTerms(radicalPart, radicalPart), Rational.make(prime))),
  )
  const inverseNorm = invertTerms(norm)
  const realResult = mulTerms(rationalPart, inverseNorm)
  const radicalResult = negTerms(mulTerms(radicalPart, inverseNorm))
  const result: Map<bigint, Rational> = new Map(realResult)
  for (const [radicand, coefficient] of radicalResult) {
    accumulate(result, radicand * prime, coefficient)
  }
  return result
}

function largestPrimeAmongKeys(value: Terms): bigint | null {
  let largest: bigint | null = null
  for (const radicand of value.keys()) {
    if (radicand === 1n) {
      continue
    }
    const prime = largestPrimeFactor(radicand)
    if (largest === null || prime > largest) {
      largest = prime
    }
  }
  return largest
}

function termsEqual(a: Terms, b: Terms): boolean {
  if (a.size !== b.size) {
    return false
  }
  for (const [radicand, coefficient] of a) {
    const other = b.get(radicand)
    if (!other || !other.equals(coefficient)) {
      return false
    }
  }
  return true
}

function signOfTerms(value: Terms): -1 | 0 | 1 {
  if (value.size === 0) {
    return 0
  }
  for (let bits = 16; bits <= MAX_SIGN_BITS; bits *= 2) {
    const { low, high } = intervalOfTerms(value, bits)
    if (low.sign() > 0) {
      return 1
    }
    if (high.sign() < 0) {
      return -1
    }
    if (low.isZero() && high.isZero()) {
      return 0
    }
  }
  throw new AlgebraicError('Could not determine the sign exactly within the precision budget')
}

/** Rigorous rational enclosure of `sum(c * sqrt(d))` at `bits` bits of root precision. */
function intervalOfTerms(value: Terms, bits: number): { low: Rational; high: Rational } {
  const scale = 1n << BigInt(bits)
  let low = Rational.ZERO
  let high = Rational.ZERO
  for (const [radicand, coefficient] of value) {
    if (radicand === 1n) {
      low = low.add(coefficient)
      high = high.add(coefficient)
      continue
    }
    const root = isqrt(radicand * scale * scale)
    const lowerBound = Rational.make(root, scale)
    const upperBound = Rational.make(root + 1n, scale)
    if (coefficient.isNegative()) {
      low = low.add(coefficient.mul(upperBound))
      high = high.add(coefficient.mul(lowerBound))
    } else {
      low = low.add(coefficient.mul(lowerBound))
      high = high.add(coefficient.mul(upperBound))
    }
  }
  return { low, high }
}

function sortedKeys(terms: Terms): bigint[] {
  return [...terms.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

function formatTerms(terms: Terms, radicalStyle: 'sqrt' | 'latex'): string {
  if (terms.size === 0) {
    return '0'
  }
  let text = ''
  for (const radicand of sortedKeys(terms)) {
    const coefficient = terms.get(radicand)
    if (!coefficient) {
      continue
    }
    const negative = coefficient.isNegative()
    const body = formatUnsignedTerm(radicand, negative ? coefficient.neg() : coefficient, radicalStyle)
    if (text === '') {
      text = negative ? `-${body}` : body
    } else {
      text += negative ? ` - ${body}` : ` + ${body}`
    }
  }
  return text
}

function singleEntry(terms: Terms): readonly [bigint, Rational] | null {
  if (terms.size !== 1) {
    return null
  }
  for (const entry of terms) {
    return entry
  }
  return null
}

function formatImaginaryUnit(radicand: bigint, magnitude: Rational, style: 'sqrt' | 'latex'): string {
  if (radicand === 1n) {
    if (magnitude.equals(Rational.ONE)) {
      return 'i'
    }
    return style === 'latex' ? `${magnitude.toLatex()}i` : `${magnitude.toString()}*i`
  }
  const body = formatUnsignedTerm(radicand, magnitude, style)
  return style === 'latex' ? `${body}i` : `${body}*i`
}

function formatImaginarySum(terms: Terms, style: 'sqrt' | 'latex'): string {
  const body = formatTerms(terms, style)
  return style === 'latex' ? `(${body})i` : `(${body})*i`
}

function formatUnsignedTerm(radicand: bigint, coefficient: Rational, style: 'sqrt' | 'latex'): string {
  if (radicand === 1n) {
    return style === 'latex' ? coefficient.toLatex() : coefficient.toString()
  }
  if (style === 'latex') {
    const radical = `\\sqrt{${radicand}}`
    if (coefficient.isInteger()) {
      return coefficient.equals(Rational.ONE) ? radical : `${coefficient.numerator}${radical}`
    }
    const numerator = coefficient.numerator === 1n ? '' : `${coefficient.numerator}`
    return `\\frac{${numerator}${radical}}{${coefficient.denominator}}`
  }
  const radical = `sqrt(${radicand})`
  if (coefficient.isInteger()) {
    return coefficient.equals(Rational.ONE) ? radical : `${coefficient.numerator}*${radical}`
  }
  const numerator = coefficient.numerator === 1n ? '' : `${coefficient.numerator}*`
  return `${numerator}${radical}/${coefficient.denominator}`
}
