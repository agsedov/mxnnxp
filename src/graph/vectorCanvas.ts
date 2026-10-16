import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'
import type { VectorCanvasMode } from './types'

/**
 * Interpretation of a matrix as a set of 2-component vectors.
 *
 * `rows` mode reads every row as a vector — the matrix must be m×2 — and `cols`
 * mode reads every column — the matrix must be 2×n. Both the evaluation (which
 * validates the shape and the values) and the widget (which draws the vectors)
 * go through these helpers, so the two can never disagree about what a value
 * means.
 */
export function fitsVectorMode(matrix: Matrix<Algebraic>, mode: VectorCanvasMode): boolean {
  return mode === 'rows' ? matrix.cols === 2 : matrix.rows === 2
}

/** How many vectors the matrix holds in the given mode. Assumes the shape fits. */
export function vectorCount(matrix: Matrix<Algebraic>, mode: VectorCanvasMode): number {
  return mode === 'rows' ? matrix.rows : matrix.cols
}

/** The two exact components of the `index`-th vector. Assumes the shape fits. */
export function vectorComponents(
  matrix: Matrix<Algebraic>,
  mode: VectorCanvasMode,
  index: number,
): readonly [Algebraic, Algebraic] {
  return mode === 'rows'
    ? [matrix.get(index, 0), matrix.get(index, 1)]
    : [matrix.get(0, index), matrix.get(1, index)]
}
