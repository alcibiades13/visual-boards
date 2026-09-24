// Auto text size (blueprint §6): the largest font size whose text box fits.
// Pure: the caller supplies how tall the text is at a given size.

export interface FitResult {
  size: number;
  /** false when even the minimum size does not fit (the inspector warns). */
  fits: boolean;
}

export function fitFontSize(heightAt: (size: number) => number, opts: { maxHeight: number; min: number; max: number }): FitResult {
  const min = Math.floor(opts.min);
  const max = Math.max(min, Math.floor(opts.max));
  if (heightAt(min) > opts.maxHeight) return { size: min, fits: false };
  let lo = min;
  let hi = max;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (heightAt(mid) <= opts.maxHeight) lo = mid;
    else hi = mid - 1;
  }
  return { size: lo, fits: true };
}

/** Limits for text over an image: at most 60% of the image area and 90% of its height. */
export function overlayLimits(width: number, height: number, boxWidth: number): { maxHeight: number; min: number; max: number } {
  return {
    maxHeight: Math.min(height * 0.9, (width * height * 0.6) / Math.max(1, boxWidth)),
    min: 12,
    max: Math.max(12, Math.min(64, width / 7)),
  };
}
