import { describe, expect, it } from 'vitest';
import { fitFontSize, overlayLimits } from './fit';

// Pretend each line holds 200/size characters and a line is 1.3×size tall.
const textOf = (chars: number, width: number) => (size: number) => Math.ceil(chars / (width / (size * 0.5))) * size * 1.3;

describe('fitFontSize', () => {
  it('picks the largest size that fits', () => {
    const heightAt = textOf(100, 300);
    const { size, fits } = fitFontSize(heightAt, { maxHeight: 120, min: 12, max: 48 });
    expect(fits).toBe(true);
    expect(heightAt(size)).toBeLessThanOrEqual(120);
    expect(heightAt(size + 1)).toBeGreaterThan(120);
  });

  it('caps at the maximum for short text', () => {
    expect(fitFontSize(textOf(5, 300), { maxHeight: 500, min: 12, max: 40 })).toEqual({ size: 40, fits: true });
  });

  it('reports when even the minimum size overflows', () => {
    expect(fitFontSize(textOf(5000, 300), { maxHeight: 100, min: 12, max: 40 })).toEqual({ size: 12, fits: false });
  });
});

describe('overlayLimits', () => {
  it('keeps the text box within 60% of the image area', () => {
    const l = overlayLimits(400, 300, 340);
    expect(l.maxHeight).toBeCloseTo((400 * 300 * 0.6) / 340);
    expect(overlayLimits(400, 100, 340).maxHeight).toBeCloseTo(70.588, 2);
    expect(overlayLimits(40, 40, 30).max).toBe(12);
  });
});
