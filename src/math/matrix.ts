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
 * Thrown when a matrix cannot be inverted: it is not square (`notSquare`) or its
 * rows are linearly dependent so no inverse exists (`singular`). Carries the
 * shape so the UI can name it in the message.
 */
export class MatrixInverseError extends Error {
  readonly reason: 'notSquare' | 'singular'
  readonly rows: number
  readonly cols: number

  constructor(reason: 'notSquare' | 'singular', rows: number, cols: number) {
    super(
      reason === 'notSquare'
        ? `Cannot invert: matrix is not square (${rows}×${cols})`
        : `Cannot invert: matrix is singular (${rows}×${cols})`,
    )
    this.name = 'MatrixInverseError'
    this.reason = reason
    this.rows = rows
    this.cols = cols
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

  /**
   * Row echelon form by exact Gaussian elimination, over any exact field.
   *
   * Rows are swapped up when a pivot position holds a zero, everything below a
   * pivot is eliminated exactly (entries left of a pivot become exact zeros,
   * not approximations), and all-zero rows sink to the bottom.
   *
   * Pivot rows are **never scaled to a leading 1**: the pivots stay whatever
   * elimination produced them as. Each elimination step preserves the
   * determinant and each row swap flips its sign, so the product of the
   * pivots — up to the swaps' parity — is the determinant of the input, which
   * is what a future determinant wants to read off this form.
   */
  static rowEchelon<T extends Scalar<T>>(matrix: Matrix<T>): Matrix<T> {
    const rows = matrix.data.map(row => [...row])
    let pivotRow = 0
    for (let col = 0; col < matrix.cols && pivotRow < matrix.rows; col++) {
      let pivot = pivotRow
      while (pivot < matrix.rows && rows[pivot][col].isZero()) {
        pivot++
      }
      if (pivot === matrix.rows) continue // whole column is zero below the pivots so far
      if (pivot !== pivotRow) {
        ;[rows[pivot], rows[pivotRow]] = [rows[pivotRow], rows[pivot]]
      }
      const pivotValue = rows[pivotRow][col]
      for (let row = pivotRow + 1; row < matrix.rows; row++) {
        const factor = rows[row][col].div(pivotValue)
        if (factor.isZero()) continue
        // Columns left of `col` are already exact zeros in this row, so start at `col`.
        for (let c = col; c < matrix.cols; c++) {
          rows[row][c] = rows[row][c].sub(factor.mul(rows[pivotRow][c]))
        }
      }
      pivotRow++
    }
    return Matrix.fromRows(rows)
  }

  /**
   * Reduced row echelon form (RREF) by Gauss–Jordan elimination over any
   * exact field.
   *
   * Pivots are scaled to 1, and elimination is performed above and below each
   * pivot. All-zero rows sink to the bottom.
   */
  static reducedRowEchelon<T extends Scalar<T>>(matrix: Matrix<T>, one: T): Matrix<T> {
    const rows = matrix.data.map(row => [...row])
    let pivotRow = 0
    for (let col = 0; col < matrix.cols && pivotRow < matrix.rows; col++) {
      let pivot = pivotRow
      while (pivot < matrix.rows && rows[pivot][col].isZero()) {
        pivot++
      }
      if (pivot === matrix.rows) continue // zero column
      if (pivot !== pivotRow) {
        ;[rows[pivot], rows[pivotRow]] = [rows[pivotRow], rows[pivot]]
      }
      const pivotValue = rows[pivotRow][col]
      // Scale pivot row so pivot becomes 1
      const invPivot = one.div(pivotValue)
      for (let c = col; c < matrix.cols; c++) {
        rows[pivotRow][c] = rows[pivotRow][c].mul(invPivot)
      }
      // Eliminate above and below
      for (let row = 0; row < matrix.rows; row++) {
        if (row === pivotRow) continue
        const factor = rows[row][col]
        if (factor.isZero()) continue
        for (let c = col; c < matrix.cols; c++) {
          rows[row][c] = rows[row][c].sub(factor.mul(rows[pivotRow][c]))
        }
      }
      pivotRow++
    }
    return Matrix.fromRows(rows)
  }

  /** Alias for {@link Matrix.reducedRowEchelon}. */
  static rref<T extends Scalar<T>>(matrix: Matrix<T>, one: T): Matrix<T> {
    return Matrix.reducedRowEchelon(matrix, one)
  }

  /** The `n × n` identity matrix over any field (the field's `zero` and `one`). */
  static identity<T extends Scalar<T>>(n: number, zero: T, one: T): Matrix<T> {
    assertPositiveSize(n, 'size')
    const rows = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? one : zero)),
    )
    return new Matrix(n, n, rows)
  }

  /**
   * Exact inverse of a square matrix, by Gauss–Jordan elimination on the
   * augmented `[A | I]`: each pivot is normalized to 1 and its column cleared
   * above and below, which turns the left block into the identity and the right
   * block into `A⁻¹`. Never falls back to floats.
   *
   * Throws {@link MatrixInverseError} when the matrix is not square
   * (`notSquare`) or when elimination finds a zero column — no inverse exists
   * (`singular`).
   */
  static inverse<T extends Scalar<T>>(matrix: Matrix<T>, zero: T, one: T): Matrix<T> {
    const n = matrix.rows
    if (n !== matrix.cols) {
      throw new MatrixInverseError('notSquare', matrix.rows, matrix.cols)
    }
    // Augment with the identity: rows[i] = [ A[i]… | I[i]… ].
    const rows: T[][] = matrix.data.map((row, i) => [
      ...row,
      ...Array.from({ length: n }, (_, j) => (i === j ? one : zero)),
    ])
    for (let col = 0; col < n; col++) {
      let pivot = col
      while (pivot < n && rows[pivot][col].isZero()) {
        pivot++
      }
      if (pivot === n) {
        throw new MatrixInverseError('singular', n, n)
      }
      if (pivot !== col) {
        ;[rows[pivot], rows[col]] = [rows[col], rows[pivot]]
      }
      const invPivot = one.div(rows[col][col])
      for (let c = col; c < n * 2; c++) {
        rows[col][c] = rows[col][c].mul(invPivot)
      }
      for (let row = 0; row < n; row++) {
        if (row === col) continue
        const factor = rows[row][col]
        if (factor.isZero()) continue
        for (let c = col; c < n * 2; c++) {
          rows[row][c] = rows[row][c].sub(factor.mul(rows[col][c]))
        }
      }
    }
    // The left block is now the identity; return the right block.
    return Matrix.fromRows(rows.map(row => row.slice(n)))
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
