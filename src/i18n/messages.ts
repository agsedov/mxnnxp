/**
 * Translation catalogue. Two locales only — English and Russian — by design;
 * there is no pluggable-locale machinery here.
 *
 * The English table is the source of truth for the key set: `MessageKey` is
 * derived from it and the Russian table is typed as `Messages`, so a missing or
 * mistyped key is a compile error.
 */

export type Locale = 'en' | 'ru'
export type Vars = Record<string, string | number>

export const LOCALES: readonly Locale[] = ['en', 'ru']
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', ru: 'RU' }

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru'
}

export const en = {
  'lang.label': 'Language',

  'toolbar.addMatrix': '+ Matrix',
  'toolbar.addMultiply': '+ Multiply',
  'toolbar.reset': 'Reset',
  'toolbar.hint':
    'drag widgets to move · drag a slot onto another to connect · click a wire or press ⌫ to remove',

  'widget.matrix.title': 'Matrix',
  'widget.matrixMultiply.title': 'Matrix multiply',
  'widget.remove': 'Remove widget',

  'widget.matrix.port.in': 'in',
  'widget.matrix.port.m': 'matrix',
  'widget.matrixMultiply.port.left': 'Left',
  'widget.matrixMultiply.port.right': 'Right',
  'widget.matrixMultiply.port.product': 'Left × Right',

  'matrix.driven': 'driven by input',
  'matrix.waiting': 'waiting for input',
  'matrix.stepper.rows': 'rows',
  'matrix.stepper.cols': 'cols',
  'matrix.stepper.fewerRows': 'Fewer rows',
  'matrix.stepper.moreRows': 'More rows',
  'matrix.stepper.fewerCols': 'Fewer columns',
  'matrix.stepper.moreCols': 'More columns',
  'matrix.cellLabel': 'Row {row} column {col}',

  'multiply.result': '{rows}×{cols} result',
  'multiply.waiting': 'waiting for {ports}',
  'multiply.noValue': 'no value yet',
  'conjunction.and': 'and',

  'error.cycle': 'Cycle detected',
  'error.dimension': 'Dimension mismatch: {leftRows}×{leftCols} times {rightRows}×{rightCols}',
  'error.cell': 'Row {row}, column {col}: not a valid exact number',
} as const

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
export type TFunction = (key: MessageKey, vars?: Vars) => string

export const ru: Messages = {
  'lang.label': 'Язык',

  'toolbar.addMatrix': '+ Матрица',
  'toolbar.addMultiply': '+ Умножение',
  'toolbar.reset': 'Сброс',
  'toolbar.hint':
    'перетаскивайте виджеты, чтобы двигать · перетащите слот на другой, чтобы соединить · щёлкните провод или нажмите ⌫, чтобы удалить',

  'widget.matrix.title': 'Матрица',
  'widget.matrixMultiply.title': 'Умножение матриц',
  'widget.remove': 'Удалить виджет',

  'widget.matrix.port.in': 'вход',
  'widget.matrix.port.m': 'матрица',
  'widget.matrixMultiply.port.left': 'Левая',
  'widget.matrixMultiply.port.right': 'Правая',
  'widget.matrixMultiply.port.product': 'Левая × Правая',

  'matrix.driven': 'управляется входом',
  'matrix.waiting': 'ожидание входа',
  'matrix.stepper.rows': 'строки',
  'matrix.stepper.cols': 'столбцы',
  'matrix.stepper.fewerRows': 'Меньше строк',
  'matrix.stepper.moreRows': 'Больше строк',
  'matrix.stepper.fewerCols': 'Меньше столбцов',
  'matrix.stepper.moreCols': 'Больше столбцов',
  'matrix.cellLabel': 'Строка {row}, столбец {col}',

  'multiply.result': 'результат {rows}×{cols}',
  'multiply.waiting': 'ожидание: {ports}',
  'multiply.noValue': 'пока нет значения',
  'conjunction.and': 'и',

  'error.cycle': 'Обнаружен цикл',
  'error.dimension': 'Несовпадение размеров: {leftRows}×{leftCols} на {rightRows}×{rightCols}',
  'error.cell': 'Строка {row}, столбец {col}: недопустимое точное число',
}

export const MESSAGES: Record<Locale, Messages> = { en, ru }

/** Substitutes `{name}` placeholders; unknown placeholders are left untouched. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  )
}
