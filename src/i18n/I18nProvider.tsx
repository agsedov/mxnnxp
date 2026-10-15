import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { I18nContext, type I18nValue } from './context'
import { LOCALE_PARAM, MESSAGES, interpolate, resolveLocale, type Locale, type MessageKey, type Vars } from './messages'

const STORAGE_KEY = 'mxnnxp.locale'

/**
 * The language to start in. A `?lang=` query parameter wins over the saved
 * preference, so a link can force a language; otherwise the saved value, and
 * finally the default.
 */
function initialLocale(): Locale {
  const param = new URLSearchParams(window.location.search).get(LOCALE_PARAM)
  const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  return resolveLocale(param, stored)
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
