import { fitFontSize, overlayLimits, type FitResult } from '@/layout/fit';
import type { TextStyle } from '@/model';
import { measureFitText, resolveTextStyle, textCss, type TextVariant } from './cardText';

// Auto-sized text for overlays and card backs, measured in the DOM once and cached.

export const OVERLAY_INSET = 0.07; // share of the card width kept free at the edges
export const OVERLAY_PAD = 14; // text box padding (panel / blur effects)

export function overlayBoxWidth(width: number): number {
  return Math.max(40, width * (1 - OVERLAY_INSET * 2));
}

export function fitOverlayText(
  text: string,
  author: string | undefined,
  style: TextStyle | undefined,
  width: number,
  height: number,
): FitResult & { style: TextStyle } {
  const resolved = resolveTextStyle('overlay', style);
  if (resolved.size !== 'auto') return { size: resolved.size, fits: true, style: resolved };
  const box = overlayBoxWidth(width);
  const inner = box - OVERLAY_PAD * 2;
  const limits = overlayLimits(width, height, box);
  const heightAt = (size: number) => measureFitText(text, author, inner, textCss('overlay', resolved, size)) + OVERLAY_PAD * 2;
  return { ...fitFontSize(heightAt, limits), style: resolved };
}

/** Quote or text on the back of a card: as large as fits the card, 11–28px. */
export function fitBackText(
  variant: Exclude<TextVariant, 'overlay'>,
  text: string,
  author: string | undefined,
  style: TextStyle | undefined,
  width: number,
  height: number,
): FitResult & { style: TextStyle } {
  const resolved = resolveTextStyle(variant, style);
  if (resolved.size !== 'auto') return { size: resolved.size, fits: true, style: resolved };
  const pad = 20;
  const heightAt = (size: number) => measureFitText(text, author, width - pad * 2, textCss(variant, resolved, size));
  return { ...fitFontSize(heightAt, { maxHeight: height - pad * 2, min: 11, max: 28 }), style: resolved };
}
