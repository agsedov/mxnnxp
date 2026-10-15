import { describe, expect, it } from 'vitest'
import { describeNodeError, portLabelKey, WIDGET_TITLE_KEY } from './labels'
import { en, interpolate, isLocale, MESSAGES, ru, type Locale, type TFunction } from './messages'

/** The real translator, without the React provider, for pure tests. */
function translator(locale: Locale): TFunction {
  return (key, vars) => interpolate(MESSAGES[locale][key], vars)
}

const t = translator('en')
const tRu = translator('ru')

describe('catalogue', () => {
  it('covers exactly the same keys in every locale', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
  })

  it('has no empty translations', () => {
    for (const [locale, table] of Object.entries(MESSAGES)) {
      for (const [key, value] of Object.entries(table)) {
        expect(value, `${locale}:${key}`).not.toBe('')
      }
    }
  })
})

describe('interpolate', () => {
  it('substitutes named placeholders', () => {
    expect(interpolate('Row {row}, column {col}', { row: 2, col: 1 })).toBe('Row 2, column 1')
  })

  it('leaves unknown placeholders untouched', () => {
    expect(interpolate('a {x} b {y}', { x: 1 })).toBe('a 1 b {y}')
  })

  it('returns the template when there are no variables', () => {
    expect(interpolate('plain')).toBe('plain')
  })
})

describe('isLocale', () => {
  it('accepts the supported locales and rejects everything else', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('ru')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(null)).toBe(false)
    expect(isLocale(undefined)).toBe(false)
  })
})

describe('labels', () => {
  it('describes a cycle error in the active language', () => {
    expect(describeNodeError(t, { code: 'cycle' }).text).toBe('Cycle detected')
    expect(describeNodeError(tRu, { code: 'cycle' }).text).toBe('Обнаружен цикл')
  })

  it('formats a dimension mismatch and keeps the shape numbers', () => {
    const error = { code: 'dimension' as const, leftRows: 1, leftCols: 3, rightRows: 1, rightCols: 2 }
    expect(describeNodeError(t, error).text).toBe('Dimension mismatch: 1×3 times 1×2')
  })

  it('localizes a cell error and keeps the parser reason as detail', () => {
    const description = describeNodeError(t, {
      code: 'cell',
      row: 2,
      col: 1,
      reason: 'Unknown name "x"',
    })
    expect(description.text).toBe('Row 2, column 1: not a valid exact number')
    expect(description.detail).toBe('Unknown name "x"')
  })

  it('maps every widget kind and slot to a translation key', () => {
    expect(WIDGET_TITLE_KEY.matrix).toBe('widget.matrix.title')
    expect(WIDGET_TITLE_KEY.matrixMultiply).toBe('widget.matrixMultiply.title')
    expect(portLabelKey('matrix', 'in')).toBe('widget.matrix.port.in')
    expect(portLabelKey('matrixMultiply', 'left')).toBe('widget.matrixMultiply.port.left')
    expect(portLabelKey('matrixMultiply', 'right')).toBe('widget.matrixMultiply.port.right')
    expect(portLabelKey('matrixMultiply', 'product')).toBe('widget.matrixMultiply.port.product')
  })
})
