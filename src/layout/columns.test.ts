import { describe, expect, it } from 'vitest';
import { columnCount, packColumns } from './columns';

describe('columnCount', () => {
  it('fits as many minimum-width columns as possible, within bounds', () => {
    expect(columnCount(1008, 240, 16)).toBe(4);
    expect(columnCount(1007, 240, 16)).toBe(3);
    expect(columnCount(100, 240, 16)).toBe(1);
    expect(columnCount(100, 240, 16, 2)).toBe(2);
    expect(columnCount(10_000, 100, 0, 1, 6)).toBe(6);
  });
});

describe('packColumns', () => {
  it('places each item into the currently shortest column, keeping order', () => {
    const { rects, height, columnWidth } = packColumns(
      [
        { id: 'a', ratio: 2 }, // tall
        { id: 'b', ratio: 1 },
        { id: 'c', ratio: 1 }, // goes under b, the shorter column
        { id: 'd', ratio: 1 },
      ],
      { width: 210, columns: 2, gap: 10 },
    );
    expect(columnWidth).toBe(100);
    expect(rects).toEqual([
      { id: 'a', x: 0, y: 0, w: 100, h: 200 },
      { id: 'b', x: 110, y: 0, w: 100, h: 100 },
      { id: 'c', x: 110, y: 110, w: 100, h: 100 },
      { id: 'd', x: 0, y: 210, w: 100, h: 100 },
    ]);
    expect(height).toBe(310);
  });

  it('leaves no vertical gap larger than the gap between items', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({ id: String(i), ratio: 0.5 + ((i * 7919) % 13) / 8 }));
    const { rects } = packColumns(items, { width: 1000, columns: 5, gap: 12 });
    const byColumn = new Map<number, typeof rects>();
    for (const r of rects) byColumn.set(r.x, [...(byColumn.get(r.x) ?? []), r]);
    for (const column of byColumn.values()) {
      column.sort((a, b) => a.y - b.y);
      expect(column[0]!.y).toBe(0);
      for (let i = 1; i < column.length; i++) {
        expect(column[i]!.y - (column[i - 1]!.y + column[i - 1]!.h)).toBeCloseTo(12);
      }
    }
  });

  it('adds fixed extra height and honours a top offset', () => {
    const { rects, height } = packColumns([{ id: 'a', ratio: 1, extra: 20 }], { width: 100, columns: 1, gap: 8, top: 50 });
    expect(rects[0]).toEqual({ id: 'a', x: 0, y: 50, w: 100, h: 120 });
    expect(height).toBe(170);
  });

  it('is deterministic and handles empty input', () => {
    const items = [{ id: 'a', ratio: 1.3 }, { id: 'b', ratio: 0.7 }];
    expect(packColumns(items, { width: 500, columns: 3, gap: 4 })).toEqual(packColumns(items, { width: 500, columns: 3, gap: 4 }));
    expect(packColumns([], { width: 500, columns: 3, gap: 4 }).height).toBe(0);
  });
});
