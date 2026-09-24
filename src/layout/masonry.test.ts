import { describe, expect, it } from 'vitest';
import { createItem, DEFAULT_MASONRY_PARAMS, type BoardItem, type FlowOverride, type MasonryParams, type Section } from '@/model';
import { flowInsertionPoint } from './hitTest';
import { EMPTY_SECTION_HEIGHT, HEADER_HEIGHT, masonryEngine, SECTION_SPACING } from './masonry';

const ratios = new Map<string, number>();
function item(ratio: number, extra: Partial<BoardItem> = {}): BoardItem {
  const it = createItem({ kind: 'text', text: '' }, extra);
  ratios.set(it.id, ratio);
  return it;
}
const measure = (it: BoardItem, w: number) => w * (ratios.get(it.id) ?? 1);

function layout(
  items: BoardItem[],
  opts: { params?: Partial<MasonryParams>; sections?: Section[]; overrides?: Record<string, FlowOverride>; width?: number; gap?: number } = {},
) {
  const params = { ...DEFAULT_MASONRY_PARAMS, padding: 0, columns: 3 as number | 'auto', ...opts.params };
  return masonryEngine.compute({
    items,
    sections: opts.sections ?? [],
    measure,
    params,
    state: { params, placements: {}, overrides: opts.overrides ?? {} },
    viewportWidth: opts.width ?? 320,
    gap: opts.gap ?? 10,
  });
}

describe('masonry engine', () => {
  it('packs into the shortest column in item order', () => {
    const [a, b, c, d] = [item(2), item(1), item(1), item(1)];
    const l = layout([a!, b!, c!, d!]); // 3 columns of 100px, gap 10
    expect(l.rects[a!.id]).toMatchObject({ x: 0, y: 0, w: 100, h: 200 });
    expect(l.rects[b!.id]).toMatchObject({ x: 110, y: 0 });
    expect(l.rects[c!.id]).toMatchObject({ x: 220, y: 0 });
    expect(l.rects[d!.id]).toMatchObject({ x: 110, y: 110 });
    expect(l.height).toBe(210);
  });

  it('never leaves a vertical gap larger than the gap between cards', () => {
    const items = Array.from({ length: 300 }, (_, i) => item(0.5 + ((i * 7919) % 17) / 10));
    const l = layout(items, { params: { columns: 5 }, width: 1000, gap: 12 });
    const columns = new Map<number, { y: number; h: number }[]>();
    for (const r of Object.values(l.rects)) columns.set(r.x, [...(columns.get(r.x) ?? []), r]);
    expect(columns.size).toBe(5);
    for (const col of columns.values()) {
      col.sort((p, q) => p.y - q.y);
      expect(col[0]!.y).toBe(0);
      for (let i = 1; i < col.length; i++) expect(col[i]!.y - (col[i - 1]!.y + col[i - 1]!.h)).toBeCloseTo(12);
    }
  });

  it('is deterministic', () => {
    const items = [item(1.2), item(0.7), item(1.5)];
    expect(layout(items)).toEqual(layout(items));
  });

  it('spans cards over adjacent columns, starting at the taller of them', () => {
    const [a, b, c] = [item(2), item(1), item(0.5)];
    const l = layout([a!, b!, c!], { overrides: { [c!.id]: { span: 2 } } });
    // columns: 0 -> 210, 1 -> 110, 2 -> 0. Best pair: columns 1-2, top = 110.
    expect(l.rects[c!.id]).toMatchObject({ x: 110, y: 110, w: 210, h: 105 });
  });

  it('clamps span to the number of columns', () => {
    const a = item(1);
    const l = layout([a], { params: { columns: 2 }, overrides: { [a.id]: { span: 3 } }, width: 210 });
    expect(l.rects[a.id]!.w).toBe(210);
  });

  it('computes auto columns from the minimum column width, 2 to 6', () => {
    const items = [item(1)];
    const cols = (width: number) => {
      const l = layout(items, { params: { columns: 'auto', minColumnWidth: 260 }, width, gap: 16 });
      return Math.round(width / l.rects[items[0]!.id]!.w);
    };
    expect(cols(390)).toBe(2); // phone
    expect(cols(1100)).toBe(4);
    expect(cols(4000)).toBe(6);
  });

  it('lays out sections as blocks under full-width headers, unsectioned first', () => {
    const sections = [{ id: 's1', title: 'Health' }, { id: 's2', title: 'Travel' }];
    const loose = item(1);
    const health = item(1, { sectionId: 's1' });
    const orphan = item(1, { sectionId: 'deleted' });
    const l = layout([health, loose, orphan], { sections });

    expect(l.blocks!.map((b) => [b.sectionId, b.itemIds])).toEqual([
      [undefined, [loose.id, orphan.id]],
      ['s1', [health.id]],
      ['s2', []],
    ]);
    const s1Top = 100 + SECTION_SPACING;
    expect(l.headers).toEqual([
      { sectionId: 's1', y: s1Top, h: HEADER_HEIGHT },
      { sectionId: 's2', y: s1Top + HEADER_HEIGHT + 100 + SECTION_SPACING, h: HEADER_HEIGHT },
    ]);
    expect(l.rects[health.id]).toMatchObject({ x: 0, y: s1Top + HEADER_HEIGHT });
    const empty = l.blocks![2]!;
    expect(empty.bottom - empty.top).toBe(HEADER_HEIGHT + EMPTY_SECTION_HEIGHT);
  });

  it('groups by month of addedAt when month dividers are on', () => {
    const sep = item(1, { addedAt: '2026-09-02T10:00:00.000Z' });
    const aug = item(1, { addedAt: '2026-08-30T10:00:00.000Z' });
    const sep2 = item(1, { addedAt: '2026-09-20T10:00:00.000Z' });
    const l = layout([sep, aug, sep2], { params: { monthDividers: true } });
    expect(l.headers.map((h) => h.sectionId)).toEqual(['month:2026-08', 'month:2026-09']);
    expect(l.blocks![1]!.itemIds).toEqual([sep.id, sep2.id]);
  });
});

describe('flowInsertionPoint', () => {
  const [a, b, c, d] = [item(1), item(1), item(1), item(1)];
  const items = [a!, b!, c!, d!];
  const l = layout(items); // row 1: a b c, row 2: d

  it('inserts before a card when over its upper half, after it over the lower half', () => {
    expect(flowInsertionPoint(l, items, 150, 20)).toEqual({ index: 1, sectionId: undefined });
    expect(flowInsertionPoint(l, items, 150, 90)).toEqual({ index: 2, sectionId: undefined });
  });

  it('uses the nearest card when the pointer is in empty space', () => {
    expect(flowInsertionPoint(l, items, 50, 500)).toEqual({ index: 4, sectionId: undefined });
  });

  it('targets sections, including empty ones', () => {
    const sections = [{ id: 's1', title: 'A' }, { id: 's2', title: 'B' }];
    const x = item(1, { sectionId: 's1' });
    const list = [a!, x];
    const sl = layout(list, { sections });
    const s1 = sl.blocks![1]!;
    const s2 = sl.blocks![2]!;
    expect(flowInsertionPoint(sl, list, 10, sl.rects[x.id]!.y + 10)).toEqual({ index: 1, sectionId: 's1' });
    expect(flowInsertionPoint(sl, list, 10, s2.top + 70)).toEqual({ index: 2, sectionId: 's2' });
    expect(flowInsertionPoint(sl, list, 10, s1.top + 5).sectionId).toBe('s1');
  });

  it('ignores placeholders and gives indexes in the list without them', () => {
    const ghost = item(1);
    const shown = [a!, ghost, b!, c!];
    const withGhost = layout(shown); // row 1: a ghost b, row 2: c
    const skip = new Set([ghost.id]);
    // Over b's upper half: before b = index 1 of [a, b, c].
    expect(flowInsertionPoint(withGhost, shown, 250, 20, skip)).toEqual({ index: 1, sectionId: undefined });
    // Over c's lower half: after c.
    expect(flowInsertionPoint(withGhost, shown, 50, 200, skip)).toEqual({ index: 3, sectionId: undefined });
  });

  it('handles an empty wall', () => {
    const empty = layout([]);
    expect(flowInsertionPoint(empty, [], 10, 10)).toEqual({ index: 0, sectionId: undefined });
  });
});
