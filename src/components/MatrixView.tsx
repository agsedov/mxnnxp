import { Tex } from './Tex'
import type { Algebraic } from '../math/exact'
import type { Matrix } from '../math/matrix'

/**
 * Read-only view of a matrix: exact numbers typeset with TeX (a matrix in
 * round parentheses — `\frac`s, `\sqrt`s, complex terms). Used wherever a widget
 * shows a value it did not produce itself, e.g. a matrix driven by its input
 * slot.
 */
export function MatrixView({ matrix }: { matrix: Matrix<Algebraic> }) {
  return <Tex latex={matrix.toLatex()} />
}
