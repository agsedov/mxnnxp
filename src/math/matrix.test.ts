import { describe, expect, it } from 'vitest'
import { Fraction } from './fraction'
import { Matrix, MatrixDimensionError } from './matrix'

const f = (text: string): Fraction => Fraction.parse(text)
const grid = (rows: string[][]): Matrix => Matrix.fromRows(rows.map(row => row.map(f)))

describe('Matrix construction', () => {
  it('builds a filled matrix', () => {
    const identity = Matrix.filled(2, 2, Fraction.ZERO)
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
    const product = Matrix.multiply(a, b)
    expect(product.toString()).toBe('[19, 22] [43, 50]')
  })

  it('keeps fractions exact through multiplication', () => {
    const a = grid([['1/3']])
    const b = grid([['1/3']])
    expect(Matrix.multiply(a, b).get(0, 0).toString()).toBe('1/9')
  })

  it('multiplies non-square matrices', () => {
    const a = grid([['1', '2', '3'], ['4', '5', '6']])
    const b = grid([['7', '8'], ['9', '10'], ['11', '12']])
    const product = Matrix.multiply(a, b)
    expect(product.rows).toBe(2)
    expect(product.cols).toBe(2)
    expect(product.toString()).toBe('[58, 64] [139, 154]')
  })

  it('throws on dimension mismatch', () => {
    const a = grid([['1', '2', '3']])
    const b = grid([['1', '2']])
    expect(() => Matrix.multiply(a, b)).toThrow(MatrixDimensionError)
  })
})

describe('Matrix.toLatex', () => {
  it('renders a bracketed matrix with fractions', () => {
    const matrix = Matrix.fromRows([[f('1/2'), f('0')], [f('0'), f('-3/4')]])
    expect(matrix.toLatex()).toBe('\\begin{bmatrix} \\frac{1}{2} & 0 \\\\ 0 & -\\frac{3}{4} \\end{bmatrix}')
  })

  it('renders a row matrix', () => {
    expect(Matrix.fromRows([[f('1'), f('2'), f('3')]]).toLatex()).toBe(
      '\\begin{bmatrix} 1 & 2 & 3 \\end{bmatrix}',
    )
  })
})
