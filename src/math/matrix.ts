import type { Scalar } from './exact/scalar'

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
 * A matrix of exact {@link Scalar} entries.
 *
 * Immutable: every operation returns a new matrix. Entries are stored row-major.
 *
 * The element type is a parameter, so the same matrix works with any exact field
 * implementing {@link Scalar}. The widget value path instantiates it with
 * `Algebraic` (from `src/math/exact/`), which subsumes the rationals and adds
 * radicals and the imaginary unit — so nothing here ever falls back to a float.
 */
export class Matrix<T extends Scalar<T>> {
  readonly rows: number
  readonly cols: number
  /** Row-major entries. */
  readonly data: readonly (readonly T[])[]

  private constructor(rows: number, cols: number, data: readonly (readonly T[])[]) {
    this.rows = rows
    this.cols = cols
    this.data = data
  }

  /** A rows×cols matrix with every entry set to `value`. */
  static filled<T extends Scalar<T>>(rows: number, cols: number, value: T): Matrix<T> {
    assertPositiveSize(rows, 'rows')
    assertPositiveSize(cols, 'columns')
    return new Matrix(rows, cols, Array.from({ length: rows }, () => Array.from({ length: cols }, () => value)))
  }

  /** Builds a matrix from rows, validating that they are non-empty and rectangular. */
  static fromRows<T extends Scalar<T>>(data: ReadonlyArray<ReadonlyArray<T>>): Matrix<T> {
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

  get(row: number, col: number): T {
    const value = this.data[row]?.[col]
    if (!value) {
      throw new RangeError(`Index (${row}, ${col}) out of bounds for ${this.rows}×${this.cols} matrix`)
    }
    return value
  }

  /**
   * Exact matrix product. Throws {@link MatrixDimensionError} when a.cols !== b.rows.
   *
   * The accumulator starts from the first product rather than a zero constant, so
   * the algorithm needs no statics from the element type.
   */
  static multiply<T extends Scalar<T>>(a: Matrix<T>, b: Matrix<T>): Matrix<T> {
    if (a.cols !== b.rows) {
      throw new MatrixDimensionError(a.cols, b.rows)
    }
    const data = Array.from({ length: a.rows }, (_, i) =>
      Array.from({ length: b.cols }, (_, j) => {
        let sum = a.get(i, 0).mul(b.get(0, j))
        for (let k = 1; k < a.cols; k++) {
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

  /**
   * LaTeX for this matrix as a `pmatrix` — round parentheses, e.g.
   * `\begin{pmatrix} 1 & \frac{1}{2} \\ 0 & 1 \end{pmatrix}`. Each entry is
   * typeset by its own `toLatex()`, so radicals and complex values render too.
   * Meant for a TeX renderer (KaTeX); the plain `toString()` stays the
   * debug/UI-free form.
   */
  toLatex(): string {
    const rows = this.data.map(row => row.map(entry => entry.toLatex()).join(' & '))
    return `\\begin{pmatrix} ${rows.join(' \\\\ ')} \\end{pmatrix}`
  }
}

function assertPositiveSize(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`Matrix ${label} must be a positive integer, got ${value}`)
  }
}
