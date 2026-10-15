import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { I18nContext, type I18nValue } from './context'
import { DEFAULT_LOCALE, MESSAGES, interpolate, isLocale, type Locale, type MessageKey, type Vars } from './messages'

const STORAGE_KEY = 'mxnnxp.locale'

/** The saved language, or the default when it is absent or unrecognized. */
function initialLocale(): Locale {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_LOCALE
  }
  const stored = localStorage.getItem(STORAGE_KEY)
  return isLocale(stored) ? stored : DEFAULT_LOCALE
}

/**
 * Holds the active language and exposes the `t()` translator. The language can
 * be switched at runtime and is remembered across reloads in `localStorage`.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  // Keep the document language in step for assistive technology and CSS.
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can be unavailable (private mode); switching still works.
    }
  }, [])

  const t = useCallback(
    (key: MessageKey, vars?: Vars) => interpolate(MESSAGES[locale][key], vars),
    [locale],
  )

  const value = useMemo<I18nValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
