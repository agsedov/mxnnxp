import { Tex } from './Tex'
import type { Matrix } from '../math/matrix'

/**
 * Read-only view of a matrix: exact fractions typeset with TeX (a bracketed
 * matrix of `\frac`s). Used wherever a widget shows a value it did not produce
 * itself, e.g. a matrix driven by its input slot.
 */
export function MatrixView({ matrix }: { matrix: Matrix }) {
  return <Tex latex={matrix.toLatex()} />
}
