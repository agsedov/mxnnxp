import type { Matrix } from '../math/matrix'

/**
 * Read-only grid of exact fractions, in `n/d` form. Used to show computed
 * values (a product, or a matrix taken over from an input slot).
 */
export function MatrixView({ matrix }: { matrix: Matrix }) {
  return (
    <div className="result-grid" style={{ gridTemplateColumns: `repeat(${matrix.cols}, minmax(46px, auto))` }}>
      {matrix.data.map((row, rowIndex) =>
        row.map((value, colIndex) => (
          <div key={`${rowIndex}:${colIndex}`} className="result-cell">
            {value.toString()}
          </div>
        )),
      )}
    </div>
  )
}
