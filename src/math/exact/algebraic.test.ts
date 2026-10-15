import { describe, expect, it } from 'vitest'
import { Algebraic, AlgebraicError } from './algebraic'
import { Rational } from './rational'

const ONE = Algebraic.ONE
const I = Algebraic.I

function integer(value: bigint | number): Algebraic {
  return Algebraic.fromInteger(value)
}

function rational(value: string): Algebraic {
  return Algebraic.fromRational(Rational.parse(value))
}

function sqrt(value: bigint): Algebraic {
  return Algebraic.sqrt(Rational.make(value))
}

function half(): Algebraic {
  return Algebraic.fromRational(Rational.make(1n, 2n))
}

describe('Algebraic square roots', () => {
  it('normalizes radicals to square-free form', () => {
    expect(sqrt(2n).toString()).toBe('sqrt(2)')
    expect(sqrt(4n).toString()).toBe('2')
    expect(sqrt(8n).toString()).toBe('2*sqrt(2)')
    expect(sqrt(12n).toString()).toBe('2*sqrt(3)')
    expect(sqrt(1000000n).toString()).toBe('1000')
  })

  it('rationalizes the denominator', () => {
    expect(Algebraic.sqrt(Rational.parse('1/2')).toString()).toBe('sqrt(2)/2')
    expect(Algebraic.sqrt(Rational.parse('2/3')).toString()).toBe('sqrt(6)/3')
    expect(Algebraic.sqrt(Rational.parse('4/9')).toString()).toBe('2/3')
  })

  it('supports imaginary square roots', () => {
    expect(Algebraic.sqrt(Rational.make(-4n)).toString()).toBe('2*i')
    expect(Algebraic.sqrt(Rational.make(-2n)).toString()).toBe('sqrt(2)*i')
    expect(Algebraic.sqrt(Rational.ZERO).isZero()).toBe(true)
  })
})

describe('Algebraic arithmetic', () => {
  it('multiplies radicals across fields', () => {
    expect(sqrt(2n).mul(sqrt(3n)).equals(sqrt(6n))).toBe(true)
    expect(sqrt(2n).mul(sqrt(2n)).equals(integer(2))).toBe(true)
    expect(sqrt(8n).equals(sqrt(2n).mul(integer(2)))).toBe(true)
  })

  it('drops back to rationals when radicals cancel', () => {
    const product = sqrt(2n).mul(sqrt(2n))
    expect(product.isRational()).toBe(true)
    expect(product.isInteger()).toBe(true)
  })

  it('adds and subtracts like terms', () => {
    expect(sqrt(2n).add(sqrt(2n)).equals(integer(2).mul(sqrt(2n)))).toBe(true)
    expect(integer(1).add(sqrt(2n)).toString()).toBe('1 + sqrt(2)')
    expect(integer(1).sub(sqrt(2n)).toString()).toBe('1 - sqrt(2)')
    expect(sqrt(2n).add(sqrt(3n)).sub(sqrt(2n)).equals(sqrt(3n))).toBe(true)
  })

  it('inverts every value back to one', () => {
    const values = [
      sqrt(2n),
      integer(1).add(sqrt(2n)),
      integer(1).add(sqrt(3n)),
      integer(1).add(sqrt(2n)).add(sqrt(3n)).add(sqrt(6n)),
      integer(2).mul(sqrt(2n)),
      half().mul(integer(1).add(sqrt(5n))),
      integer(3).sub(integer(2).mul(sqrt(3n))),
      Algebraic.sqrt(Rational.parse('1/2')),
      I,
      integer(1).add(I),
      integer(2).add(integer(3).mul(I)),
    ]
    for (const value of values) {
      expect(value.mul(value.inv()).equals(ONE)).toBe(true)
    }
  })

  it('computes familiar inverses', () => {
    expect(sqrt(2n).inv().equals(sqrt(2n).div(integer(2)))).toBe(true)
    expect(integer(1).add(sqrt(2n)).inv().equals(sqrt(2n).sub(integer(1)))).toBe(true)
  })
})

describe('Algebraic complex arithmetic', () => {
  it('squares i to -1', () => {
    expect(I.mul(I).equals(integer(-1))).toBe(true)
    expect(I.pow(integer(4)).equals(ONE)).toBe(true)
    expect(I.inv().equals(I.neg())).toBe(true)
  })

  it('divides complex numbers', () => {
    const inverse = integer(1).add(I).inv()
    expect(inverse.equals(half().mul(integer(1).sub(I)))).toBe(true)
  })

  it('multiplies conjugates to a real value', () => {
    expect(integer(1).add(I).mul(integer(1).sub(I)).equals(integer(2))).toBe(true)
  })

  it('exposes conjugate and parts', () => {
    const value = integer(1).add(integer(2).mul(I))
    expect(value.conjugate().equals(integer(1).sub(integer(2).mul(I)))).toBe(true)
    expect(value.realPart().equals(ONE)).toBe(true)
    expect(value.imagPart().equals(integer(2).mul(I))).toBe(true)
  })

  it('keeps a rotation determinant exactly 1', () => {
    const cosine = half().mul(sqrt(3n))
    const sine = half()
    const determinant = cosine.mul(cosine).add(sine.mul(sine))
    expect(determinant.equals(ONE)).toBe(true)
  })
})

describe('Algebraic golden-ratio identities', () => {
  it('satisfies phi^2 = phi + 1 and phi * psi = -1', () => {
    const phi = half().mul(integer(1).add(sqrt(5n)))
    const psi = half().mul(integer(1).sub(sqrt(5n)))
    expect(phi.mul(phi).equals(phi.add(ONE))).toBe(true)
    expect(phi.mul(psi).equals(integer(-1))).toBe(true)
  })
})

describe('Algebraic ordering', () => {
  it('compares real values exactly', () => {
    expect(sqrt(2n).compare(integer(1))).toBe(1)
    expect(sqrt(2n).compare(rational('3/2'))).toBe(-1)
    expect(sqrt(2n).compare(sqrt(8n).div(integer(2)))).toBe(0)
    expect(sqrt(2n).sub(rational('1.4142')).sign()).toBe(1)
    expect(half().mul(integer(1).sub(sqrt(5n))).sign()).toBe(-1)
    expect(sqrt(2n).mul(sqrt(2n)).sub(integer(2)).sign()).toBe(0)
    expect(ONE.sign()).toBe(1)
    expect(Algebraic.ZERO.sign()).toBe(0)
  })

  it('refines precision until the sign is decided', () => {
    // These differ from sqrt(2) around the 11th decimal, well below the
    // precision of the first interval, so the routine must refine.
    expect(sqrt(2n).sub(rational('1.41421356237')).sign()).toBe(1)
    expect(rational('1.41421356238').sub(sqrt(2n)).sign()).toBe(1)
    expect(sqrt(2n).compare(rational('1.41421356238'))).toBe(-1)
  })

  it('refuses to order complex numbers', () => {
    expect(() => I.sign()).toThrow(AlgebraicError)
    expect(() => I.compare(ONE)).toThrow(AlgebraicError)
    expect(() => ONE.compare(I)).toThrow(AlgebraicError)
  })
})

describe('Algebraic powers and roots', () => {
  it('raises to integer and rational powers', () => {
    expect(sqrt(2n).pow(integer(2)).equals(integer(2))).toBe(true)
    expect(integer(2).pow(half()).equals(sqrt(2n))).toBe(true)
    expect(integer(8).pow(Algebraic.fromRational(Rational.make(1n, 3n))).equals(integer(2))).toBe(true)
    expect(
      integer(4).pow(Algebraic.fromRational(Rational.make(-1n, 2n))).equals(half()),
    ).toBe(true)
  })

  it('takes exact roots or reports the tower limit', () => {
    expect(integer(27).nthRoot(3n).equals(integer(3))).toBe(true)
    expect(integer(-8).nthRoot(3n).equals(integer(-2))).toBe(true)
    expect(integer(4).nthRoot(2n).equals(integer(2))).toBe(true)
    expect(integer(4).nthRoot(2n).equals(integer(2))).toBe(true)
    expect(integer(-4).nthRoot(2n).equals(integer(2).mul(I))).toBe(true)
    expect(() => integer(2).nthRoot(3n)).toThrow(AlgebraicError)
    expect(() => integer(-4).nthRoot(2n).nthRoot(2n)).toThrow(AlgebraicError)
  })

  it('rejects irrational exponents', () => {
    expect(() => integer(2).pow(sqrt(2n))).toThrow(AlgebraicError)
    expect(() => integer(2).pow(I)).toThrow(AlgebraicError)
  })
})

describe('Algebraic display', () => {
  it('formats plain strings that re-parse', () => {
    expect(integer(1).add(sqrt(2n)).toString()).toBe('1 + sqrt(2)')
    expect(integer(1).sub(sqrt(2n)).toString()).toBe('1 - sqrt(2)')
    expect(sqrt(2n).div(integer(2)).toString()).toBe('sqrt(2)/2')
    expect(half().mul(integer(1).add(sqrt(5n))).toString()).toBe('1/2 + sqrt(5)/2')
    expect(integer(2).mul(sqrt(2n)).toString()).toBe('2*sqrt(2)')
  })

  it('formats complex values', () => {
    expect(I.toString()).toBe('i')
    expect(I.neg().toString()).toBe('-i')
    expect(integer(1).sub(I).toString()).toBe('1 - i')
    expect(integer(2).mul(I).toString()).toBe('2*i')
    expect(integer(1).add(sqrt(2n)).mul(I).toString()).toBe('(1 + sqrt(2))*i')
  })

  it('renders LaTeX', () => {
    expect(integer(1).add(sqrt(2n)).toLatex()).toBe('1 + \\sqrt{2}')
    expect(sqrt(2n).div(integer(2)).toLatex()).toBe('\\frac{\\sqrt{2}}{2}')
    expect(half().mul(integer(1).add(sqrt(5n))).toLatex()).toBe('\\frac{1}{2} + \\frac{\\sqrt{5}}{2}')
    expect(I.toLatex()).toBe('i')
    expect(integer(1).sub(I).toLatex()).toBe('1 - i')
    expect(integer(2).mul(I).toLatex()).toBe('2i')
    expect(integer(1).add(sqrt(2n)).mul(I).toLatex()).toBe('(1 + \\sqrt{2})i')
  })

  it('approximates only real values, for display', () => {
    expect(Math.abs(sqrt(2n).toNumber() - Math.SQRT2)).toBeLessThan(1e-12)
    expect(() => I.toNumber()).toThrow(AlgebraicError)
  })
})

describe('Algebraic precision', () => {
  it('is exact far beyond 2^53', () => {
    const big = 2n ** 60n + 1n
    expect(integer(big).add(integer(1n)).equals(integer(big + 1n))).toBe(true)
    expect(integer(big).sub(integer(big)).isZero()).toBe(true)
  })

  it('reports rational/integer status structurally', () => {
    expect(sqrt(2n).isRational()).toBe(false)
    expect(sqrt(4n).isRational()).toBe(true)
    expect(sqrt(4n).isInteger()).toBe(true)
    expect(rational('3/4').isRational()).toBe(true)
    expect(rational('3/4').isInteger()).toBe(false)
    expect(() => sqrt(2n).toRational()).toThrow(AlgebraicError)
  })
})

describe('Algebraic algebra laws', () => {
  const samples = [
    integer(0),
    integer(1),
    integer(-3),
    rational('3/4'),
    sqrt(2n),
    integer(1).add(sqrt(2n)),
    integer(3).sub(integer(2).mul(sqrt(3n))),
    half().mul(integer(1).add(sqrt(5n))),
    I,
    integer(2).add(integer(3).mul(I)),
  ]

  it('is additive- and multiplicative-associative over samples', () => {
    for (const x of samples) {
      for (const y of samples) {
        expect(x.add(y).equals(y.add(x))).toBe(true)
        expect(x.mul(y).equals(y.mul(x))).toBe(true)
        expect(x.sub(y).add(y).equals(x)).toBe(true)
        if (!y.isZero()) {
          expect(x.div(y).mul(y).equals(x)).toBe(true)
        }
      }
    }
  })

  it('respects the distributive law', () => {
    for (const x of samples) {
      for (const y of samples) {
        for (const z of samples) {
          expect(x.mul(y.add(z)).equals(x.mul(y).add(x.mul(z)))).toBe(true)
        }
      }
    }
  })
})

describe('Algebraic error paths', () => {
  it('rejects invalid constructions and operations', () => {
    expect(() => Algebraic.make([[0n, Rational.ONE]])).toThrow(RangeError)
    expect(() => Algebraic.make([[-2n, Rational.ONE]])).toThrow(RangeError)
    expect(() => Algebraic.ZERO.inv()).toThrow(RangeError)
    expect(() => ONE.div(Algebraic.ZERO)).toThrow(RangeError)
    expect(() => integer(2).nthRoot(0n)).toThrow(AlgebraicError)
  })

  it('normalizes a radicand given in reducible form', () => {
    expect(Algebraic.make([[8n, Rational.ONE]]).equals(sqrt(8n))).toBe(true)
    expect(Algebraic.make([[1n, Rational.ONE]], [[4n, Rational.ONE]]).toString()).toBe('1 + 2*i')
  })
})
