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
export const MAX_DIM = 0.8;

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

/**
 * Colors for things drawn directly on the wall (section titles, empty areas,
 * the add button). Cards keep their own colors. Theme and image backgrounds
 * use the theme (images get a theme-colored veil).
 */
export function wallInkVars(background: BoardBackground): CSSProperties {
  if (background.kind !== 'color') return {};
  const l = luminance(background.value);
  if (l === null) return {};
  const dark = l < 0.25;
  return {
    '--wall-ink': dark ? '#f1ede6' : '#1f1d1a',
    '--wall-muted': dark ? 'rgb(241 237 230 / 0.7)' : 'rgb(31 29 26 / 0.65)',
    '--wall-line': dark ? 'rgb(241 237 230 / 0.22)' : 'rgb(31 29 26 / 0.16)',
  } as CSSProperties;
}
