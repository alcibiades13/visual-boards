import { describe, expect, it } from 'vitest';
import { luminance, wallInkVars } from './wallBackground';

describe('wall background', () => {
  it('computes luminance of hex colors', () => {
    expect(luminance('#000')).toBe(0);
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('var(--vb-board)')).toBeNull();
  });

  it('uses light text on dark walls, dark text on light walls, theme otherwise', () => {
    expect(wallInkVars({ kind: 'color', value: '#1e2530' })).toMatchObject({ '--wall-ink': '#f1ede6' });
    expect(wallInkVars({ kind: 'color', value: '#f7f3ec' })).toMatchObject({ '--wall-ink': '#1f1d1a' });
    expect(wallInkVars({ kind: 'color', value: 'var(--vb-board)' })).toEqual({});
    expect(wallInkVars({ kind: 'image', assetId: 'a' })).toEqual({});
  });
});
