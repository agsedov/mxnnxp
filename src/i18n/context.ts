import { createContext, useContext } from 'react'

import type { Locale, MessageKey, Vars } from './messages'

export interface I18nValue {
  readonly locale: Locale
  readonly setLocale: (locale: Locale) => void
  readonly t: (key: MessageKey, vars?: Vars) => string
}

export const I18nContext = createContext<I18nValue | null>(null)

/** The active language and translator. Requires an enclosing `I18nProvider`. */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) {
    throw new Error('useI18n must be used inside <I18nProvider>')
  }
  return value
}
