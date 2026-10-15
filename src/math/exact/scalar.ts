/**
 * The operations the field-generic linear-algebra algorithms need from a
 * number type. Both {@link import('./rational').Rational} and
 * {@link import('./algebraic').Algebraic} implement it, so `rref`, `det`,
 * `rank` and `solve` can be written once and used with either.
 *
 * Constants (`zero`, `one`) are not part of the interface because TypeScript
 * interfaces cannot carry statics; the algorithms take them as parameters.
 */
export interface Scalar<T> {
  add(other: T): T
  sub(other: T): T
  mul(other: T): T
  div(other: T): T
  neg(): T
  isZero(): boolean
  equals(other: T): boolean
  /**
   * Ordering sign: -1, 0 or 1. Throws for values that have no ordering — in
   * particular for non-real complex numbers.
   */
  sign(): -1 | 0 | 1
  toString(): string
  toLatex(): string
}
