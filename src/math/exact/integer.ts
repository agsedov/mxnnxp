/**
 * BigInt number-theory helpers for the exact number tower.
 *
 * These are the only non-trivial integer primitives the exact arithmetic
 * needs. Radicands come from small primes a student types, so square-free
 * decomposition uses bounded trial division and fails loudly (rather than
 * silently returning a wrong exact result) when a radicand is too large to
 * factor.
 */

/** Largest trial-division factor we are willing to scan (2^24 ≈ 16.7M). */
const MAX_TRIAL_FACTOR = 2n ** 24n

/** A decomposition `n = square² * squarefree` with `squarefree` square-free. */
export interface SquarefreeDecomposition {
  square: bigint
  squarefree: bigint
}

/** Absolute value of a BigInt. */
export function bigAbs(value: bigint): bigint {
  return value < 0n ? -value : value
}

/** Greatest common divisor, always non-negative. */
export function gcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a)
  let y = bigAbs(b)
  while (y !== 0n) {
    const rest = x % y
    x = y
    y = rest
  }
  return x
}

/** Number of bits needed to write `value` (0 for 0). */
export function bitLength(value: bigint): number {
  const magnitude = bigAbs(value)
  return magnitude === 0n ? 0 : magnitude.toString(2).length
}

/** `base ** exponent` for a non-negative BigInt exponent. */
export function bigPow(base: bigint, exponent: bigint): bigint {
  if (exponent < 0n) {
    throw new RangeError(`bigPow expects a non-negative exponent, got ${exponent}`)
  }
  let result = 1n
  let factor = base
  let power = exponent
  while (power > 0n) {
    if (power & 1n) {
      result *= factor
    }
    power >>= 1n
    if (power > 0n) {
      factor *= factor
    }
  }
  return result
}

/** Floor of the square root of a non-negative integer (Newton's method). */
export function isqrt(value: bigint): bigint {
  if (value < 0n) {
    throw new RangeError(`isqrt expects a non-negative integer, got ${value}`)
  }
  if (value < 2n) {
    return value
  }
  let x = 1n << BigInt(Math.ceil(bitLength(value) / 2))
  let y = (x + value / x) >> 1n
  while (y < x) {
    x = y
    y = (x + value / x) >> 1n
  }
  return x
}

/** Floor of the `degree`-th root of a non-negative integer. */
export function integerNthRoot(value: bigint, degree: bigint): bigint {
  if (value < 0n) {
    throw new RangeError(`integerNthRoot expects a non-negative value, got ${value}`)
  }
  if (degree < 1n) {
    throw new RangeError(`integerNthRoot expects a positive degree, got ${degree}`)
  }
  if (value < 2n || degree === 1n) {
    return value
  }
  let low = 0n
  let upper = (1n << BigInt(Math.ceil(bitLength(value) / Number(degree)))) + 1n
  while (upper - low > 1n) {
    const middle = (low + upper) >> 1n
    if (bigPow(middle, degree) <= value) {
      low = middle
    } else {
      upper = middle
    }
  }
  return low
}

/**
 * Decomposes a positive integer `n` as `square² * squarefree`, where the
 * returned `squarefree` has no repeated prime factor. This is what turns a
 * radicand like 8 into `2 * sqrt(2)`.
 */
export function squarefreeDecompose(value: bigint): SquarefreeDecomposition {
  if (value < 1n) {
    throw new RangeError(`squarefreeDecompose expects a positive integer, got ${value}`)
  }
  let square = 1n
  let remaining = value
  let factor = 2n
  while (factor * factor <= remaining) {
    if (factor > MAX_TRIAL_FACTOR) {
      throw new RangeError(`Cannot normalise the radicand ${value} exactly: too large to factor`)
    }
    const squareFactor = factor * factor
    while (remaining % squareFactor === 0n) {
      remaining /= squareFactor
      square *= factor
    }
    factor += 1n
  }
  return { square, squarefree: remaining }
}

/** Largest prime factor of `value >= 2` (bounded trial division). */
export function largestPrimeFactor(value: bigint): bigint {
  if (value < 2n) {
    throw new RangeError(`largestPrimeFactor expects an integer >= 2, got ${value}`)
  }
  let remaining = value
  let largest = 1n
  let factor = 2n
  while (factor * factor <= remaining) {
    if (factor > MAX_TRIAL_FACTOR) {
      throw new RangeError(`Cannot factor ${value} exactly: too large for bounded trial division`)
    }
    if (remaining % factor === 0n) {
      largest = factor
      while (remaining % factor === 0n) {
        remaining /= factor
      }
    }
    factor += 1n
  }
  return remaining > largest ? remaining : largest
}
