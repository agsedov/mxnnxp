import { memo, useCallback, useMemo } from 'react'
import { Fraction } from '../math/fraction'
import type { MatrixNodeData } from '../graph/types'

const MIN_DIM = 1
const MAX_DIM = 6

function clampDim(value: number): number {
  return Math.min(MAX_DIM, Math.max(MIN_DIM, value))
}

/** Grows or shrinks the grid, preserving existing cell text. */
function resizeCells(cells: string[][], rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) => cells[row]?.[col] ?? '0'))
}

interface MatrixEditorProps {
  data: MatrixNodeData
  onChange: (next: MatrixNodeData) => void
}

export const MatrixEditor = memo(function MatrixEditor({ data, onChange }: MatrixEditorProps) {
  const validFlags = useMemo(
    () => data.cells.map(row => row.map(cell => Fraction.tryParse(cell) !== null)),
    [data.cells],
  )

  const setCell = useCallback(
    (row: number, col: number, value: string) => {
      onChange({
        ...data,
        cells: data.cells.map((cellsRow, r) =>
          r === row ? cellsRow.map((cell, c) => (c === col ? value : cell)) : cellsRow,
        ),
      })
    },
    [data, onChange],
  )

  const resize = useCallback(
    (rows: number, cols: number) => {
      const nextRows = clampDim(rows)
      const nextCols = clampDim(cols)
      onChange({ rows: nextRows, cols: nextCols, cells: resizeCells(data.cells, nextRows, nextCols) })
    },
    [data.cells, onChange],
  )

  return (
    <div className="matrix-editor nodrag">
      <div className="dim-row">
        <Stepper
          label="rows"
          value={data.rows}
          onDecrement={() => resize(data.rows - 1, data.cols)}
          onIncrement={() => resize(data.rows + 1, data.cols)}
        />
        <Stepper
          label="cols"
          value={data.cols}
          onDecrement={() => resize(data.rows, data.cols - 1)}
          onIncrement={() => resize(data.rows, data.cols + 1)}
        />
      </div>
      <div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${data.cols}, 46px)` }}>
        {data.cells.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <input
              key={`${rowIndex}:${colIndex}`}
              className={`cell${validFlags[rowIndex][colIndex] ? '' : ' cell-invalid'}`}
              value={cell}
              onChange={event => setCell(rowIndex, colIndex, event.target.value)}
              spellCheck={false}
              aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}`}
            />
          )),
        )}
      </div>
    </div>
  )
})

function Stepper({
  label,
  value,
  onDecrement,
  onIncrement,
}: {
  label: string
  value: number
  onDecrement: () => void
  onIncrement: () => void
}) {
  return (
    <span className="stepper">
      <span className="stepper-label">{label}</span>
      <button className="stepper-btn nodrag" onClick={onDecrement} disabled={value <= MIN_DIM} title={`Fewer ${label}`}>
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button className="stepper-btn nodrag" onClick={onIncrement} disabled={value >= MAX_DIM} title={`More ${label}`}>
        +
      </button>
    </span>
  )
}
