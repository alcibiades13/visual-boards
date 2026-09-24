import { describe, expect, it } from 'vitest';
import { EFFECTS, gradientDirection, overlayPresentation, positionCss, POSITIONS } from './overlayStyle';

describe('overlay presentation', () => {
  it('maps the 3×3 grid to flex alignment', () => {
    expect(positionCss('tl')).toEqual({ justifyContent: 'flex-start', alignItems: 'flex-start' });
    expect(positionCss('c')).toEqual({ justifyContent: 'center', alignItems: 'center' });
    expect(positionCss('br')).toEqual({ justifyContent: 'flex-end', alignItems: 'flex-end' });
    expect(positionCss('cr')).toEqual({ justifyContent: 'center', alignItems: 'flex-end' });
  });

  it('starts gradients at the edge the text is on', () => {
    expect(gradientDirection('bc')).toBe('to top');
    expect(gradientDirection('tr')).toBe('to bottom');
    expect(gradientDirection('cl')).toBe('to right');
    expect(gradientDirection('c')).toBeNull();
  });

  it('covers all 9 positions and 7 effects; intensity scales the effect', () => {
    expect(POSITIONS).toHaveLength(9);
    expect(EFFECTS).toHaveLength(7);
    const weak = overlayPresentation('panel', 'bc', 0).box.background;
    const strong = overlayPresentation('panel', 'bc', 1).box.background;
    expect(weak).not.toEqual(strong);
    expect(overlayPresentation('light-gradient', 'c', 0.5).color).toContain('31 29 26');
    expect(overlayPresentation('none', 'c', 1)).toMatchObject({ box: {}, text: {} });
  });
});
