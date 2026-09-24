import { requestPersistentStorage } from '@/data/storage';
import { getRepos } from '@/data/repos';
import { useLocale, type Locale } from '@/i18n';

export const LOCALE_KEY = 'locale';

/** One-time startup work. Failures never block the UI. */
export async function boot(): Promise<void> {
  const [locale] = await Promise.allSettled([
    getRepos().meta.get<Locale>(LOCALE_KEY),
    requestPersistentStorage(),
  ]);
  if (locale.status === 'fulfilled' && locale.value) useLocale.getState().setLocale(locale.value);
  else document.documentElement.lang = useLocale.getState().locale;
}

export async function saveLocale(locale: Locale): Promise<void> {
  useLocale.getState().setLocale(locale);
  await getRepos().meta.set(LOCALE_KEY, locale);
}
