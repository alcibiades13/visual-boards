import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createBoard, createItem } from './defaults';
import { addSection, insertItems, layoutState, moveItems, moveSection, removeItems, removeSection, setSpan } from './operations';
import type { Board } from './types';

function boardWith(n: number): Board {
  const board = createBoard({ title: 't' });
  for (let i = 0; i < n; i++) board.items.push({ ...createItem({ kind: 'text', text: String(i) }), id: `i${i}` });
  return board;
}
const ids = (b: Board) => b.items.map((i) => i.id);

describe('board operations', () => {
  it('inserts at an index and into a section', () => {
    const b = produce(boardWith(3), (d) => insertItems(d, [{ ...createItem({ kind: 'text', text: 'x' }), id: 'x' }], 1, 's1'));
    expect(ids(b)).toEqual(['i0', 'x', 'i1', 'i2']);
    expect(b.items[1]!.sectionId).toBe('s1');
  });

  it('moves several cards to an index of the list without them, keeping their order', () => {
    const b = produce(boardWith(6), (d) => moveItems(d, ['i4', 'i1'], 2, undefined));
    // without moved: i0 i2 i3 i5 -> insert at 2
    expect(ids(b)).toEqual(['i0', 'i2', 'i1', 'i4', 'i3', 'i5']);
  });

  it('moves a card to another section, or keeps sections with null', () => {
    const start = produce(boardWith(2), (d) => void (d.items[0]!.sectionId = 'a'));
    expect(produce(start, (d) => moveItems(d, ['i0'], 1, 'b')).items[1]!.sectionId).toBe('b');
    expect(produce(start, (d) => moveItems(d, ['i0'], 1, undefined)).items[1]!.sectionId).toBeUndefined();
    expect(produce(start, (d) => moveItems(d, ['i0'], 1, null)).items[1]!.sectionId).toBe('a');
  });

  it('removes cards with their layout data and cover', () => {
    const b = produce(boardWith(3), (d) => {
      d.coverItemId = 'i1';
      setSpan(d, 'masonry', ['i1'], 2);
      layoutState(d, 'freeform').placements.i1 = { x: 0, y: 0, w: 1, h: 1, rotation: 0, z: 0 };
      removeItems(d, ['i1']);
    });
    expect(ids(b)).toEqual(['i0', 'i2']);
    expect(b.layouts.masonry?.overrides.i1).toBeUndefined();
    expect(b.layouts.freeform?.placements.i1).toBeUndefined();
    expect(b.coverItemId).toBeUndefined();
  });

  it('sets and clears span without touching other layouts', () => {
    let b = produce(boardWith(1), (d) => setSpan(d, 'masonry', ['i0'], 3));
    expect(b.layouts.masonry?.overrides.i0).toEqual({ span: 3 });
    b = produce(b, (d) => setSpan(d, 'masonry', ['i0'], 1));
    expect(b.layouts.masonry?.overrides.i0).toBeUndefined();
    expect(b.layouts.freeform).toBeUndefined();
  });

  it('adds, reorders and removes sections; cards of a removed section stay', () => {
    let s1 = '';
    let b = produce(boardWith(1), (d) => {
      s1 = addSection(d, 'Health');
      addSection(d, 'Travel');
      d.items[0]!.sectionId = s1;
    });
    b = produce(b, (d) => moveSection(d, s1, 1));
    expect(b.sections.map((s) => s.title)).toEqual(['Travel', 'Health']);
    b = produce(b, (d) => removeSection(d, s1));
    expect(b.sections.map((s) => s.title)).toEqual(['Travel']);
    expect(b.items).toHaveLength(1);
    expect(b.items[0]!.sectionId).toBeUndefined();
  });
});
