import { create } from 'zustand';
import { en, type MessageKey, type Messages } from './en';
import { sr } from './sr';

export type Locale = 'en' | 'sr';
export type { MessageKey };

const catalogs: Record<Locale, Messages> = { en, sr };

function detectLocale(): Locale {
  const lang = typeof navigator === 'undefined' ? 'en' : navigator.language.toLowerCase();
  return /^(sr|hr|bs|me)\b/.test(lang) ? 'sr' : 'en';
}

interface LocaleState {
  locale: Locale;
  setLocale(locale: Locale): void;
}

export const useLocale = create<LocaleState>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    document.documentElement.lang = locale;
    set({ locale });
  },
}));

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = catalogs[locale][key];
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export function useT() {
  const locale = useLocale((s) => s.locale);
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}
