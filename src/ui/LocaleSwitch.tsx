import { saveLocale } from '@/app/boot';
import { useLocale, useT, type Locale } from '@/i18n';

const LOCALES: Locale[] = ['en', 'sr'];

export function LocaleSwitch() {
  const t = useT();
  const current = useLocale((s) => s.locale);
  return (
    <div role="group" aria-label={t('nav.language')} className="flex text-xs text-muted">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          aria-pressed={current === locale}
          onClick={() => void saveLocale(locale)}
          className="rounded px-1.5 py-1 uppercase tracking-wide transition-colors duration-(--vb-fast) hover:text-ink aria-pressed:text-ink aria-pressed:font-medium"
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
