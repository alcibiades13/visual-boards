import { describe, expect, it } from 'vitest';
import { en } from './en';
import { translate } from '.';
import { sr } from './sr';

describe('translate', () => {
  it('interpolates and picks plural forms', () => {
    expect(translate('en', 'library.count.images', { count: 1 })).toBe('1 image');
    expect(translate('en', 'library.count.images', { count: 5 })).toBe('5 images');
    expect(translate('sr', 'library.count.images', { count: 1 })).toBe('1 slika');
    expect(translate('sr', 'library.count.images', { count: 3 })).toBe('3 slike');
    expect(translate('sr', 'library.count.images', { count: 5 })).toBe('5 slika');
    expect(translate('sr', 'library.count.images', { count: 21 })).toBe('21 slika');
    expect(translate('sr', 'library.count.images', { count: 22 })).toBe('22 slike');
  });

  it('has the same number of plural forms in every message pair', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (!en[key].includes('{count}')) continue;
      const enForms = en[key].split('|').length;
      const srForms = sr[key].split('|').length;
      {
        expect([enForms, srForms], key).toEqual([2, 3]);
      }
    }
  });
});
