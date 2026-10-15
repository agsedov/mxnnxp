import { useI18n } from '../i18n/context'
import { LOCALES, LOCALE_LABELS } from '../i18n/messages'

/** Toolbar control for switching the interface language (English / Russian). */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t('lang.label')}>
      {LOCALES.map(code => (
        <button
          key={code}
          type="button"
          className={`lang-btn${code === locale ? ' lang-btn-active' : ''}`}
          aria-pressed={code === locale}
          onClick={() => setLocale(code)}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  )
}
