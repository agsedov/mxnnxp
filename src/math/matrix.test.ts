import { describe, expect, it } from 'vitest'
import { Algebraic, parseExact } from './exact'
import { Matrix, MatrixDimensionError } from './matrix'

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
