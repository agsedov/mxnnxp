import { describe, expect, it } from 'vitest'
import { Algebraic, parseExact } from './exact'
import { Matrix, MatrixDimensionError, MatrixInverseError } from './matrix'

const f = (text: string): Algebraic => parseExact(text)
const grid = (rows: string[][]): Matrix<Algebraic> => Matrix.fromRows(rows.map(row => row.map(f)))

describe('Matrix construction', () => {
  it('builds a filled matrix', () => {
    const identity = Matrix.filled(2, 2, Algebraic.ZERO)
    expect(identity.rows).toBe(2)
    expect(identity.cols).toBe(2)
    expect(identity.get(1, 1).toString()).toBe('0')
  })

  it('rejects ragged or empty input', () => {
    expect(() => Matrix.fromRows([])).toThrow(RangeError)
    expect(() => Matrix.fromRows([[f('1')], [f('1'), f('2')]])).toThrow(RangeError)
  })

  it('rejects out-of-bounds access', () => {
    const m = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(() => m.get(2, 0)).toThrow(RangeError)
  })
})

describe('Matrix.multiply', () => {
  it('multiplies 2×2 by 2×2 exactly', () => {
    const a = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    const b = grid([
      ['5', '6'],
      ['7', '8'],
    ])
    expect(Matrix.multiply(a, b).toString()).toBe('[19, 22] [43, 50]')
  })

  it('multiplies fractions exactly', () => {
    const product = Matrix.multiply(grid([['1/2']]), grid([['2/3']]))
    expect(product.get(0, 0).toString()).toBe('1/3')
  })

  it('multiplies non-square matrices', () => {
    const a = grid([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
    const b = grid([
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ])
    const product = Matrix.multiply(a, b)
    expect(product.rows).toBe(2)
    expect(product.cols).toBe(2)
    expect(product.toString()).toBe('[22, 28] [49, 64]')
  })

  it('keeps radicals and complex numbers exact', () => {
    expect(Matrix.multiply(grid([['sqrt(2)']]), grid([['sqrt(2)']])).get(0, 0).toString()).toBe('2')
    expect(Matrix.multiply(grid([['i']]), grid([['i']])).get(0, 0).toString()).toBe('-1')
  })

  it('squares the golden ratio exactly (φ² = φ + 1)', () => {
    const phi = grid([['(1 + sqrt(5))/2']])
    expect(Matrix.multiply(phi, phi).get(0, 0).toString()).toBe('3/2 + sqrt(5)/2')
  })

  it('throws on dimension mismatch', () => {
    const a = grid([['1', '2', '3']])
    const b = grid([['1', '2']])
    expect(() => Matrix.multiply(a, b)).toThrow(MatrixDimensionError)
  })
})

describe('Matrix.rowEchelon', () => {
  it('eliminates below the pivot, keeping the pivot as computed', () => {
    const m = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(Matrix.rowEchelon(m).toString()).toBe('[1, 2] [0, -2]')
  })

  it('keeps pivots unscaled (1/2 stays 1/2, not 1)', () => {
    const m = grid([
      ['1/2', '1/3'],
      ['1', '1'],
    ])
    expect(Matrix.rowEchelon(m).toString()).toBe('[1/2, 1/3] [0, 1/3]')
  })

  it('swaps in a nonzero row when the pivot position holds zero', () => {
    const m = grid([
      ['0', '2'],
      ['1', '3'],
    ])
    expect(Matrix.rowEchelon(m).toString()).toBe('[1, 3] [0, 2]')
  })

  it('sinks an all-zero row to the bottom', () => {
    const m = grid([
      ['2', '4'],
      ['1', '2'],
    ])
    expect(Matrix.rowEchelon(m).toString()).toBe('[2, 4] [0, 0]')
  })

  it('steps pivots right over columns that are zero below them', () => {
    const m = grid([
      ['1', '2', '3'],
      ['0', '0', '1'],
      ['0', '0', '2'],
    ])
    expect(Matrix.rowEchelon(m).toString()).toBe('[1, 2, 3] [0, 0, 1] [0, 0, 0]')
  })

  it('keeps irrational and complex entries exact', () => {
    expect(
      Matrix.rowEchelon(
        grid([
          ['sqrt(2)', '2'],
          ['1', '3'],
        ]),
      ).toString(),
    ).toBe('[sqrt(2), 2] [0, 3 - sqrt(2)]')
    expect(
      Matrix.rowEchelon(
        grid([
          ['i', '1'],
          ['1', 'i'],
        ]),
      ).toString(),
    ).toBe('[i, 1] [0, 2*i]')
  })

  it('leaves the input matrix untouched', () => {
    const m = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    Matrix.rowEchelon(m)
    expect(m.toString()).toBe('[1, 2] [3, 4]')
  })
})

describe('Matrix.reducedRowEchelon', () => {
  it('produces the reduced form, with normalized pivots and zeros above them', () => {
    const m = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    expect(Matrix.rref(m, Algebraic.ONE).toString()).toBe('[1, 0] [0, 1]')
  })

  it('scales pivots to 1', () => {
    const m = grid([
      ['2', '4'],
      ['1', '3'],
    ])
    expect(Matrix.rref(m, Algebraic.ONE).toString()).toBe('[1, 0] [0, 1]')
  })

  it('eliminates above the pivot, not only below', () => {
    const m = grid([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
    expect(Matrix.rref(m, Algebraic.ONE).toString()).toBe('[1, 0, -1] [0, 1, 2]')
  })

  it('steps over a zero column and leaves a rank-deficient matrix in rref', () => {
    const m = grid([
      ['1', '2', '3'],
      ['2', '4', '6'],
    ])
    expect(Matrix.rref(m, Algebraic.ONE).toString()).toBe('[1, 2, 3] [0, 0, 0]')
  })

  it('keeps fractions, radicals and complex numbers exact', () => {
    expect(
      Matrix.rref(
        grid([
          ['1/2', '1/3'],
          ['1', '1'],
        ]),
        Algebraic.ONE,
      ).toString(),
    ).toBe('[1, 0] [0, 1]')
    expect(Matrix.rref(grid([['sqrt(2)', '2']]), Algebraic.ONE).toString()).toBe('[1, sqrt(2)]')
    expect(
      Matrix.rref(
        grid([
          ['i', '1'],
          ['1', 'i'],
        ]),
        Algebraic.ONE,
      ).toString(),
    ).toBe('[1, 0] [0, 1]')
  })

  it('leaves the input matrix untouched', () => {
    const m = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    Matrix.rref(m, Algebraic.ONE)
    expect(m.toString()).toBe('[1, 2] [3, 4]')
  })
})

describe('Matrix.identity', () => {
  it('builds the identity over the given field', () => {
    expect(Matrix.identity(3, Algebraic.ZERO, Algebraic.ONE).toString()).toBe('[1, 0, 0] [0, 1, 0] [0, 0, 1]')
  })

  it('rejects a non-positive size', () => {
    expect(() => Matrix.identity(0, Algebraic.ZERO, Algebraic.ONE)).toThrow(RangeError)
  })
})

describe('Matrix.inverse', () => {
  const inverse = (cells: string[][]) => Matrix.inverse(grid(cells), Algebraic.ZERO, Algebraic.ONE)

  it('inverts a 2×2 matrix', () => {
    expect(
      inverse([
        ['1', '2'],
        ['3', '4'],
      ]).toString(),
    ).toBe('[-2, 1] [3/2, -1/2]')
  })

  it('inverts a 3×3 matrix with fractions', () => {
    expect(
      Matrix.inverse(
        grid([
          ['1', '2', '3'],
          ['0', '1', '4'],
          ['5', '6', '0'],
        ]),
        Algebraic.ZERO,
        Algebraic.ONE,
      ).toString(),
    ).toBe('[-24, 18, 5] [20, -15, -4] [-5, 4, 1]')
  })

  it('inverts a diagonal of radicals exactly', () => {
    const m = grid([
      ['sqrt(2)', '0'],
      ['0', '2'],
    ])
    expect(Matrix.inverse(m, Algebraic.ZERO, Algebraic.ONE).toString()).toBe('[sqrt(2)/2, 0] [0, 1/2]')
  })

  it('satisfies A·A⁻¹ = I', () => {
    const m = grid([
      ['2', '1'],
      ['1', '3'],
    ])
    const product = Matrix.multiply(m, Matrix.inverse(m, Algebraic.ZERO, Algebraic.ONE))
    expect(product.toString()).toBe('[1, 0] [0, 1]')
  })

  it('inverts an identity to itself', () => {
    const identity = Matrix.identity(3, Algebraic.ZERO, Algebraic.ONE)
    expect(Matrix.inverse(identity, Algebraic.ZERO, Algebraic.ONE).toString()).toBe(identity.toString())
  })

  it('throws notSquare for a non-square matrix', () => {
    const m = grid([
      ['1', '2', '3'],
      ['4', '5', '6'],
    ])
    expect(() => Matrix.inverse(m, Algebraic.ZERO, Algebraic.ONE)).toThrow(MatrixInverseError)
    try {
      Matrix.inverse(m, Algebraic.ZERO, Algebraic.ONE)
    } catch (error) {
      expect((error as MatrixInverseError).reason).toBe('notSquare')
    }
  })

  it('throws singular when a column has no pivot', () => {
    const m = grid([
      ['1', '2'],
      ['2', '4'],
    ])
    try {
      Matrix.inverse(m, Algebraic.ZERO, Algebraic.ONE)
      throw new Error('expected the inverse to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(MatrixInverseError)
      expect((error as MatrixInverseError).reason).toBe('singular')
      expect((error as MatrixInverseError).rows).toBe(2)
      expect((error as MatrixInverseError).cols).toBe(2)
    }
  })

  it('leaves the input matrix untouched', () => {
    const m = grid([
      ['1', '2'],
      ['3', '4'],
    ])
    Matrix.inverse(m, Algebraic.ZERO, Algebraic.ONE)
    expect(m.toString()).toBe('[1, 2] [3, 4]')
  })
})

describe('Matrix.toLatex', () => {
  it('renders a parenthesised matrix with fractions', () => {
    const matrix = Matrix.fromRows([
      [f('1/2'), f('0')],
      [f('0'), f('-3/4')],
    ])
    expect(matrix.toLatex()).toBe('\\begin{pmatrix} \\frac{1}{2} & 0 \\\\ 0 & -\\frac{3}{4} \\end{pmatrix}')
  })

  it('renders a row matrix', () => {
    expect(Matrix.fromRows([[f('1'), f('2'), f('3')]]).toLatex()).toBe(
      '\\begin{pmatrix} 1 & 2 & 3 \\end{pmatrix}',
    )
  })

  it('renders radicals and complex numbers', () => {
    const matrix = Matrix.fromRows([
      [f('sqrt(2)/2'), f('i')],
      [f('0'), f('1 - i')],
    ])
    expect(matrix.toLatex()).toBe('\\begin{pmatrix} \\frac{\\sqrt{2}}{2} & i \\\\ 0 & 1 - i \\end{pmatrix}')
  })
})
