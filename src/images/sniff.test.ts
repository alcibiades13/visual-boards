import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fitWithin } from './process';
import { isHeicBytes, isHeicFile, isImageFile } from './sniff';

describe('sniff', () => {
  it('recognises HEIC by its ftyp brand', () => {
    const heic = new Uint8Array(readFileSync('tests/fixtures/sample.heic'));
    expect(isHeicBytes(heic)).toBe(true);
    expect(isHeicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });

  it('recognises images by type or extension', () => {
    expect(isImageFile({ name: 'a.jpg', type: 'image/jpeg' })).toBe(true);
    expect(isImageFile({ name: 'IMG_0001.HEIC', type: '' })).toBe(true);
    expect(isImageFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(isHeicFile({ name: 'IMG_0001.HEIC', type: '' })).toBe(true);
  });
});

describe('fitWithin', () => {
  it('scales the long side down to the maximum and never up', () => {
    expect(fitWithin(4800, 3200, 2400)).toEqual({ width: 2400, height: 1600 });
    expect(fitWithin(3000, 4000, 2400)).toEqual({ width: 1800, height: 2400 });
    expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600 });
  });
});
