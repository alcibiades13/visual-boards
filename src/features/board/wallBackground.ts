import type { CSSProperties } from 'react';
import type { BoardBackground } from '@/model';

// Board background choices (blueprint MVP "pozadina boarda"). Swatch values are
// the user's content choice, stored literally; the default follows the theme.

export const BACKGROUND_SWATCHES = [
  '#f7f3ec', // paper
  '#ece6da', // linen
  '#e3e7df', // sage
  '#e6e1ea', // lavender
  '#f1e3d8', // clay
  '#2b2926', // charcoal
  '#1e2530', // night
  '#35302b', // walnut
];

export const DEFAULT_DIM = 0.3;
export const VEIL_COLORS = { light: '#f7f3ec', dark: '#141312' } as const;
export const MAX_DIM = 1;

/** Relative luminance (WCAG) of a #rgb / #rrggbb color; null for anything else. */
export function luminance(color: string): number | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const hex = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join('') : m[1]!;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const LIGHT_INK = {
  '--wall-ink': '#f1ede6',
  '--wall-muted': 'rgb(241 237 230 / 0.75)',
  '--wall-line': 'rgb(241 237 230 / 0.3)',
} as CSSProperties;
const DARK_INK = {
  '--wall-ink': '#1f1d1a',
  '--wall-muted': 'rgb(31 29 26 / 0.7)',
  '--wall-line': 'rgb(31 29 26 / 0.2)',
} as CSSProperties;

/**
 * Colors for things drawn directly on the wall (section titles, empty areas,
 * the add button). Cards keep their own colors. The theme background uses the
 * theme; a color or a veiled image picks light or dark text to match.
 */
export function wallInkVars(background: BoardBackground): CSSProperties {
  if (background.kind === 'image') {
    if ((background.dim ?? 0) < 0.15) return {}; // barely veiled: keep the theme
    return background.veil === 'dark' ? LIGHT_INK : DARK_INK;
  }
  if (background.kind !== 'color') return {};
  const l = luminance(background.value);
  if (l === null) return {};
  return l < 0.25 ? LIGHT_INK : DARK_INK;
}
