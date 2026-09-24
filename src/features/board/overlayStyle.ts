import type { CSSProperties } from 'react';
import type { OverlayEffect, OverlayPosition } from '@/model';

// Readability effects for text over photos (blueprint §6). These colors are
// part of the content (black/white over an image), not UI chrome, so they do
// not follow the app theme.

const INK = '31 29 26';
const PAPER = '250 248 244';

/** New text over an image: bottom centre on a dark gradient reads well on most photos. */
export const DEFAULT_OVERLAY = { position: 'bc', effect: 'dark-gradient', intensity: 0.7 } as const;

export const POSITIONS: OverlayPosition[] = ['tl', 'tc', 'tr', 'cl', 'c', 'cr', 'bl', 'bc', 'br'];
export const EFFECTS: OverlayEffect[] = ['shadow', 'dark-gradient', 'light-gradient', 'panel', 'blur', 'outline', 'none'];

/** Flex alignment of the text box inside the image. */
export function positionCss(position: OverlayPosition): CSSProperties {
  const v = position[0] === 't' ? 'flex-start' : position[0] === 'b' ? 'flex-end' : 'center';
  const h = position.length === 1 ? 'center' : position[1] === 'l' ? 'flex-start' : position[1] === 'r' ? 'flex-end' : 'center';
  return { justifyContent: v, alignItems: h };
}

/** Direction a gradient starts from: the edge the text sits on. */
export function gradientDirection(position: OverlayPosition): string | null {
  if (position[0] === 't') return 'to bottom';
  if (position[0] === 'b') return 'to top';
  if (position === 'cl') return 'to right';
  if (position === 'cr') return 'to left';
  return null; // centre: radial
}

export interface OverlayPresentation {
  layer?: CSSProperties; // over the whole image
  box: CSSProperties; // around the text
  text: CSSProperties;
  color: string; // default text color
}

function gradient(position: OverlayPosition, rgb: string, i: number): string {
  const dir = gradientDirection(position);
  if (!dir) return `radial-gradient(ellipse at center, rgb(${rgb} / ${0.62 * i}) 0%, rgb(${rgb} / ${0.25 * i}) 45%, transparent 75%)`;
  return `linear-gradient(${dir}, rgb(${rgb} / ${0.8 * i}) 0%, rgb(${rgb} / ${0.35 * i}) 45%, transparent 80%)`;
}

export function overlayPresentation(effect: OverlayEffect, position: OverlayPosition, intensity: number): OverlayPresentation {
  const i = Math.max(0, Math.min(1, intensity));
  const light = `rgb(${PAPER})`;
  const dark = `rgb(${INK})`;
  switch (effect) {
    case 'shadow':
      return { box: {}, text: { textShadow: `0 1px ${2 + 8 * i}px rgb(0 0 0 / ${0.35 + 0.55 * i})` }, color: light };
    case 'dark-gradient':
      return { layer: { background: gradient(position, '0 0 0', i) }, box: {}, text: {}, color: light };
    case 'light-gradient':
      return { layer: { background: gradient(position, PAPER, i) }, box: {}, text: {}, color: dark };
    case 'panel':
      return { box: { background: `rgb(${INK} / ${0.2 + 0.55 * i})`, borderRadius: 6 }, text: {}, color: light };
    case 'blur':
      return {
        box: {
          backdropFilter: `blur(${3 + 12 * i}px)`,
          WebkitBackdropFilter: `blur(${3 + 12 * i}px)`,
          background: `rgb(${INK} / ${0.1 + 0.25 * i})`,
          borderRadius: 6,
        },
        text: {},
        color: light,
      };
    case 'outline':
      return {
        box: {},
        text: { WebkitTextStroke: `${(0.6 + 1.6 * i).toFixed(2)}px rgb(0 0 0 / 0.85)`, paintOrder: 'stroke fill' },
        color: light,
      };
    case 'none':
      return { box: {}, text: {}, color: light };
  }
}
