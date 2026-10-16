import { describe, expect, it } from 'vitest'
import { parseExact, type Algebraic } from '../math/exact'
import { Matrix } from '../math/matrix'
import { fitsVectorMode, vectorComponents, vectorCount } from './vectorCanvas'

function matrix(cells: string[][]): Matrix<Algebraic> {
  return Matrix.fromRows(cells.map(row => row.map(parseExact)))
}

describe('fitsVectorMode', () => {
  it('asks for two columns in rows mode and two rows in cols mode', () => {
    const wide = matrix([['1', '2', '3'], ['4', '5', '6']]) // 2×3
    const tall = matrix([['1', '2'], ['3', '4'], ['5', '6']]) // 3×2
    const square = matrix([['1', '2'], ['3', '4']]) // 2×2

    expect(fitsVectorMode(wide, 'rows')).toBe(false)
    expect(fitsVectorMode(wide, 'cols')).toBe(true)
    expect(fitsVectorMode(tall, 'rows')).toBe(true)
    expect(fitsVectorMode(tall, 'cols')).toBe(false)
    expect(fitsVectorMode(square, 'rows')).toBe(true)
    expect(fitsVectorMode(square, 'cols')).toBe(true)
  })
})

describe('vectorCount and vectorComponents', () => {
  it('reads rows as vectors', () => {
    const tall = matrix([['1', '2'], ['3', '4'], ['5', '6']]) // 3×2
    expect(vectorCount(tall, 'rows')).toBe(3)
    expect(vectorComponents(tall, 'rows', 1).map(value => value.toString())).toEqual(['3', '4'])
  })

  it('reads columns as vectors', () => {
    const wide = matrix([['1', '2', '3'], ['4', '5', '6']]) // 2×3
    expect(vectorCount(wide, 'cols')).toBe(3)
    expect(vectorComponents(wide, 'cols', 2).map(value => value.toString())).toEqual(['3', '6'])
  })
})
