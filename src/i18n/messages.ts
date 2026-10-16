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

/** Query-string parameter that forces the interface language, e.g. `?lang=ru`. */
export const LOCALE_PARAM = 'lang'

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ru'
}

/**
 * Chooses the language to start in. An explicit `?lang=` value wins over the
 * saved preference, so a link can force a language; anything unrecognized is
 * ignored and the saved value (or the default) is used instead.
 */
export function resolveLocale(param: string | null, stored: string | null): Locale {
  if (isLocale(param)) {
    return param
  }
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

export const en = {
  'lang.label': 'Language',

  'toolbar.addMatrix': '+ Matrix',
  'toolbar.addMultiply': '+ Multiply',
  'toolbar.addScalar': '+ Scalar',
  'toolbar.addScalarMultiply': '+ Scalar Multiply',
  'toolbar.addVectorCanvas': '+ Vector Canvas',
  'toolbar.reset': 'Reset',
  'toolbar.hint':
    'drag widgets to move · drag a slot onto another to connect · click a wire or press ⌫ to remove',

  'widget.matrix.title': 'Matrix',
  'widget.matrixMultiply.title': 'Matrix multiply',
  'widget.scalar.title': 'Scalar',
  'widget.scalarMultiply.title': 'Scalar multiply',
  'widget.vectorCanvas.title': 'Vector canvas',
  'widget.remove': 'Remove widget',

  'widget.matrix.port.in': 'in',
  'widget.matrix.port.m': 'matrix',
  'widget.matrixMultiply.port.left': 'Left',
  'widget.matrixMultiply.port.right': 'Right',
  'widget.matrixMultiply.port.product': 'Left × Right',
  'widget.scalar.port.s': 'scalar',
  'widget.scalarMultiply.port.matrix': 'Matrix',
  'widget.scalarMultiply.port.scalar': 'Scalar',
  'widget.scalarMultiply.port.product': 'Product',
  'widget.vectorCanvas.port.m': 'matrix',

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
  'scalar.error': 'not a valid exact number',
  'scalarMultiply.waiting': 'waiting for {ports}',
  'vectorCanvas.mode.label': 'Mode',
  'vectorCanvas.mode.rows': 'Rows as vectors (2D)',
  'vectorCanvas.mode.cols': 'Columns as vectors (2D)',
  'vectorCanvas.mode.rows.short': 'Rows',
  'vectorCanvas.mode.cols.short': 'Columns',
  'vectorCanvas.waiting': 'waiting for {ports}',
  'vectorCanvas.count': 'vectors: {count}',
  'vectorCanvas.error.dim': 'Vector canvas needs 2 columns (or 2 rows), got {rows}×{cols}',
  'vectorCanvas.error.type': 'Waiting for a 2D matrix (each vector has 2 components)',
  'conjunction.and': 'and',

  'error.cycle': 'Cycle detected',
  'error.dimension': 'Dimension mismatch: {leftRows}×{leftCols} times {rightRows}×{rightCols}',
  'error.cell': 'Row {row}, column {col}: not a valid exact number',
  'error.complex': 'Row {row}, column {col}: complex numbers cannot be plotted',
} as const

export type MessageKey = keyof typeof en
export type Messages = Record<MessageKey, string>
export type TFunction = (key: MessageKey, vars?: Vars) => string

export const ru: Messages = {
  'lang.label': 'Язык',

  'toolbar.addMatrix': '+ Матрица',
  'toolbar.addMultiply': '+ Умножение',
  'toolbar.addScalar': '+ Скаляр',
  'toolbar.addScalarMultiply': '+ Умножение на скаляр',
  'toolbar.addVectorCanvas': '+ Векторный холст',
  'toolbar.reset': 'Сброс',
  'toolbar.hint':
    'перетаскивайте виджеты, чтобы двигать · перетащите слот на другой, чтобы соединить · щёлкните провод или нажмите ⌫, чтобы удалить',

  'widget.matrix.title': 'Матрица',
  'widget.matrixMultiply.title': 'Умножение матриц',
  'widget.scalar.title': 'Скаляр',
  'widget.scalarMultiply.title': 'Умножение на скаляр',
  'widget.vectorCanvas.title': 'Векторный холст',
  'widget.remove': 'Удалить виджет',

  'widget.matrix.port.in': 'вход',
  'widget.matrix.port.m': 'матрица',
  'widget.matrixMultiply.port.left': 'Левая',
  'widget.matrixMultiply.port.right': 'Правая',
  'widget.matrixMultiply.port.product': 'Левая × Правая',
  'widget.scalar.port.s': 'скаляр',
  'widget.scalarMultiply.port.matrix': 'Матрица',
  'widget.scalarMultiply.port.scalar': 'Скаляр',
  'widget.scalarMultiply.port.product': 'Произведение',
  'widget.vectorCanvas.port.m': 'матрица',

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
  'scalar.error': 'недопустимое точное число',
  'scalarMultiply.waiting': 'ожидание: {ports}',
  'vectorCanvas.mode.label': 'Режим',
  'vectorCanvas.mode.rows': 'Строки как векторы (2D)',
  'vectorCanvas.mode.cols': 'Столбцы как векторы (2D)',
  'vectorCanvas.mode.rows.short': 'Строки',
  'vectorCanvas.mode.cols.short': 'Столбцы',
  'vectorCanvas.waiting': 'ожидание: {ports}',
  'vectorCanvas.count': 'векторов: {count}',
  'vectorCanvas.error.dim': 'Нужна матрица 2×n или n×2, получено {rows}×{cols}',
  'vectorCanvas.error.type': 'Ожидание матрицы размерности 2D (каждый вектор — 2 компоненты)',
  'conjunction.and': 'и',

  'error.cycle': 'Обнаружен цикл',
  'error.dimension': 'Несовпадение размеров: {leftRows}×{leftCols} на {rightRows}×{rightCols}',
  'error.cell': 'Строка {row}, столбец {col}: недопустимое точное число',
  'error.complex': 'Строка {row}, столбец {col}: комплексные числа не отображаются',
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
