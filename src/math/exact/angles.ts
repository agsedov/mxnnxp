import { Algebraic } from './algebraic'
import { Rational } from './rational'

/**
 * Exact `[cos, sin]` pairs for the **basic angles**: the multiples of `pi/6` and
 * `pi/4` on the unit circle, in `[0, 2*pi)`.
 *
 * Keys are the angle strings — `'0'`, `'pi/6'`, `'5pi/4'`, ... — and every angle
 * appears exactly once: `pi/2` is `'pi/2'`, never `'3pi/6'` or `'2pi/4'`, and
 * `0` is not repeated as `'2pi'`. The values are exact `Algebraic` numbers
 * (`sqrt(3)/2`, `1/2`, ...), so they need no approximation.
 */
export type CosSin = readonly [cos: Algebraic, sin: Algebraic]

const half = Algebraic.fromRational(Rational.make(1n, 2n))
const sqrt2over2 = Algebraic.sqrt(Rational.make(1n, 2n))
const sqrt3over2 = Algebraic.sqrt(Rational.make(3n, 4n))

export const COS_SIN_TABLE: Record<string, CosSin> = {
  '0': [Algebraic.ONE, Algebraic.ZERO],
  'pi/6': [sqrt3over2, half],
  'pi/4': [sqrt2over2, sqrt2over2],
  'pi/3': [half, sqrt3over2],
  'pi/2': [Algebraic.ZERO, Algebraic.ONE],
  '2pi/3': [half.neg(), sqrt3over2],
  '3pi/4': [sqrt2over2.neg(), sqrt2over2],
  '5pi/6': [sqrt3over2.neg(), half],
  'pi': [Algebraic.ONE.neg(), Algebraic.ZERO],
  '7pi/6': [sqrt3over2.neg(), half.neg()],
  '5pi/4': [sqrt2over2.neg(), sqrt2over2.neg()],
  '4pi/3': [half.neg(), sqrt3over2.neg()],
  '3pi/2': [Algebraic.ZERO, Algebraic.ONE.neg()],
  '5pi/3': [half, sqrt3over2.neg()],
  '7pi/4': [sqrt2over2, sqrt2over2.neg()],
  '11pi/6': [sqrt3over2, half.neg()],
}
