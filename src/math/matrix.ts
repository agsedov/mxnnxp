import { Fraction } from './fraction'

/** Thrown when two matrices cannot be multiplied because inner dimensions differ. */
export class MatrixDimensionError extends Error {
  readonly leftCols: number
  readonly rightRows: number

  constructor(leftCols: number, rightRows: number) {
    super(`Cannot multiply: inner dimensions do not match (${leftCols} vs ${rightRows})`)
    this.name = 'MatrixDimensionError'
    this.leftCols = leftCols
    this.rightRows = rightRows
  }
}

/**
 * A matrix of exact {@link Fraction} entries.
 *
 * Immutable: every operation returns a new matrix. All entries are stored
 * row-major and are guaranteed to be normalized fractions.
 */
export class Matrix {
  readonly rows: number
  readonly cols: number
  /** Row-major entries. */
  readonly data: readonly (readonly Fraction[])[]

  private constructor(rows: number, cols: number, data: readonly (readonly Fraction[])[]) {
    this.rows = rows
    this.cols = cols
    this.data = data
  }

  /** A rows×cols matrix with every entry set to `value` (default 0). */
  static filled(rows: number, cols: number, value: Fraction = Fraction.ZERO): Matrix {
    assertPositiveSize(rows, 'rows')
    assertPositiveSize(cols, 'columns')
    return new Matrix(rows, cols, Array.from({ length: rows }, () => Array.from({ length: cols }, () => value)))
  }

  /** Builds a matrix from rows, validating that they are non-empty and rectangular. */
  static fromRows(data: ReadonlyArray<ReadonlyArray<Fraction>>): Matrix {
    const rows = data.length
    if (rows === 0) {
      throw new RangeError('A matrix must have at least one row')
    }
    const cols = data[0].length
    if (cols === 0) {
      throw new RangeError('A matrix must have at least one column')
    }
    for (const row of data) {
      if (row.length !== cols) {
        throw new RangeError('All matrix rows must have the same length')
      }
    }
    return new Matrix(rows, cols, data.map(row => [...row]))
  }

  get(row: number, col: number): Fraction {
    const value = this.data[row]?.[col]
    if (!value) {
      throw new RangeError(`Index (${row}, ${col}) out of bounds for ${this.rows}×${this.cols} matrix`)
    }
    return value
  }

  /** Exact matrix product. Throws {@link MatrixDimensionError} when a.cols !== b.rows. */
  static multiply(a: Matrix, b: Matrix): Matrix {
    if (a.cols !== b.rows) {
      throw new MatrixDimensionError(a.cols, b.rows)
    }
    const data = Array.from({ length: a.rows }, (_, i) =>
      Array.from({ length: b.cols }, (_, j) => {
        let sum = Fraction.ZERO
        for (let k = 0; k < a.cols; k++) {
          sum = sum.add(a.get(i, k).mul(b.get(k, j)))
        }
        return sum
      }),
    )
    return new Matrix(a.rows, b.cols, data)
  }

  toString(): string {
    return this.data.map(row => `[${row.join(', ')}]`).join(' ')
  }
}

function assertPositiveSize(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`Matrix ${label} must be a positive integer, got ${value}`)
  }
}
