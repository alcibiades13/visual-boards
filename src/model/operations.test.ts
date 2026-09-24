import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { createBoard, createItem } from './defaults';
import {
  addSection,
  insertItems,
  layoutState,
  moveItems,
  moveSection,
  removeBack,
  removeItems,
  removeOverlay,
  removeSection,
  setBack,
  setCaption,
  setFaceText,
  setFocal,
  setItemStyle,
  setOverlay,
  setSpan,
  setTextStyle,
  updateOverlay,
} from './operations';
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

describe('card content operations', () => {
  const base = () => {
    const board = createBoard({ title: 't' });
    board.items.push({ ...createItem({ kind: 'image', assetId: 'a1' }), id: 'img' }, { ...createItem({ kind: 'text', text: 'Hi' }), id: 'txt' });
    return board;
  };
  const style = { font: 'newsreader' as const, size: 'auto' as const, weight: 400 as const, italic: false, align: 'center' as const, color: '#fff' };

  it('adds, updates and removes an overlay on image cards only', () => {
    let b = produce(base(), (d) => {
      setOverlay(d, 'img', { source: { quoteId: 'q1' }, position: 'bc', effect: 'dark-gradient', intensity: 0.6 });
      setOverlay(d, 'txt', { source: { quoteId: 'q1' }, position: 'bc', effect: 'none', intensity: 0 });
    });
    expect(b.items[0]!.front).toMatchObject({ overlay: { position: 'bc' } });
    expect(b.items[1]!.front).toEqual({ kind: 'text', text: 'Hi' });
    b = produce(b, (d) => updateOverlay(d, 'img', { position: 'tl', intensity: 1 }));
    expect(b.items[0]!.front).toMatchObject({ overlay: { position: 'tl', intensity: 1, effect: 'dark-gradient' } });
    b = produce(b, (d) => removeOverlay(d, 'img'));
    expect(b.items[0]!.front).toEqual({ kind: 'image', assetId: 'a1' });
  });

  it('makes and unmakes flip cards', () => {
    let b = produce(base(), (d) => setBack(d, 'img', { kind: 'quote', quoteId: 'q1' }));
    expect(b.items[0]!.back).toEqual({ kind: 'quote', quoteId: 'q1' });
    b = produce(b, (d) => removeBack(d, 'img'));
    expect(b.items[0]!.back).toBeUndefined();
  });

  it('sets caption, style, focal point, text and text style', () => {
    const b = produce(base(), (d) => {
      setCaption(d, 'img', 'Kyoto');
      setItemStyle(d, ['img', 'txt'], { radius: 0, shadow: 'lifted', border: { width: 2, color: '#000' } });
      setFocal(d, 'img', { x: 0.2, y: 0.8 });
      setFaceText(d, 'txt', 'front', 'Hello');
      setTextStyle(d, ['txt'], 'front', { italic: true }, style);
    });
    expect(b.items[0]).toMatchObject({ caption: 'Kyoto', style: { radius: 0, shadow: 'lifted', border: { width: 2 } }, front: { focal: { x: 0.2, y: 0.8 } } });
    expect(b.items[1]!.front).toEqual({ kind: 'text', text: 'Hello', textStyle: { ...style, italic: true } });
    const cleared = produce(b, (d) => {
      setCaption(d, 'img', '');
      setItemStyle(d, ['img'], { border: undefined });
    });
    expect(cleared.items[0]!.caption).toBeUndefined();
    expect(cleared.items[0]!.style.border).toBeUndefined();
  });
});
