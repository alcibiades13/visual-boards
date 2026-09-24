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

// Plural categories in the order the "|"-separated forms are written.
const PLURAL_ORDER: Record<Locale, Intl.LDMLPluralRule[]> = {
  en: ['one', 'other'],
  sr: ['one', 'few', 'other'],
};
const pluralRules = new Map<Locale, Intl.PluralRules>();

function pickPlural(locale: Locale, forms: string[], count: number): string {
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(locale)));
  const index = PLURAL_ORDER[locale].indexOf(rules.select(count));
  return forms[index] ?? forms[forms.length - 1]!;
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  let text: string = catalogs[locale][key];
  if (typeof vars?.count === 'number' && text.includes('{count}') && text.includes('|')) text = pickPlural(locale, text.split('|'), vars.count);
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.replaceAll(`{${k}}`, String(v));
  return text;
}

export function useT() {
  const locale = useLocale((s) => s.locale);
  return (key: MessageKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

/** "3 hours ago" / "pre 3 sata". */
export function formatRelative(locale: Locale, iso: string, now = Date.now()): string {
  const seconds = (Date.parse(iso) - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(0, 'minute');
}

export function useFormatRelative() {
  const locale = useLocale((s) => s.locale);
  return (iso: string) => formatRelative(locale, iso);
}
