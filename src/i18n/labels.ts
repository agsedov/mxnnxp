import type { NodeError, WidgetKind } from '../graph/types'
import type { MessageKey, TFunction } from './messages'

/**
 * Presentation keys for widget kinds and their slots. The graph engine carries
 * only structural slot ids; their human labels are resolved here, in the active
 * language.
 */
export const WIDGET_TITLE_KEY: Record<WidgetKind, MessageKey> = {
  matrix: 'widget.matrix.title',
  matrixMultiply: 'widget.matrixMultiply.title',
  scalar: 'widget.scalar.title',
  scalarMultiply: 'widget.scalarMultiply.title',
  vectorCanvas: 'widget.vectorCanvas.title',
}

const PORT_LABEL_KEY: Record<WidgetKind, Record<string, MessageKey>> = {
  matrix: {
    in: 'widget.matrix.port.in',
    m: 'widget.matrix.port.m',
  },
  matrixMultiply: {
    left: 'widget.matrixMultiply.port.left',
    right: 'widget.matrixMultiply.port.right',
    product: 'widget.matrixMultiply.port.product',
  },
  scalar: {
    s: 'widget.scalar.port.s',
  },
  scalarMultiply: {
    matrix: 'widget.scalarMultiply.port.matrix',
    scalar: 'widget.scalarMultiply.port.scalar',
    product: 'widget.scalarMultiply.port.product',
  },
  vectorCanvas: {
    m: 'widget.vectorCanvas.port.m',
  },
}

/** Message key for a slot label. Slot ids come from `WIDGET_SPECS` and are known. */
export function portLabelKey(kind: WidgetKind, portId: string): MessageKey {
  return PORT_LABEL_KEY[kind][portId]
}

/** A localized sentence for a widget error, plus the raw parser message if any. */
export interface NodeErrorText {
  readonly text: string
  readonly detail?: string
}

export function describeNodeError(t: TFunction, error: NodeError): NodeErrorText {
  switch (error.code) {
    case 'cycle':
      return { text: t('error.cycle') }
    case 'dimension':
      return {
        text: t('error.dimension', {
          leftRows: error.leftRows,
          leftCols: error.leftCols,
          rightRows: error.rightRows,
          rightCols: error.rightCols,
        }),
      }
    case 'cell':
      return { text: t('error.cell', { row: error.row, col: error.col }), detail: error.reason }
  }
}
