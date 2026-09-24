import { describe, expect, it } from 'vitest';
import { EMPTY_SELECTION, pruneSelection, select } from './selection';

const order = ['a', 'b', 'c', 'd', 'e'];
const ids = (s: { ids: ReadonlySet<string> }) => [...s.ids].sort();

describe('select', () => {
  it('replaces on plain click', () => {
    const s = select(select(EMPTY_SELECTION, order, 'a', 'replace'), order, 'c', 'replace');
    expect(ids(s)).toEqual(['c']);
    expect(s.anchor).toBe('c');
  });

  it('toggles with Cmd/Ctrl', () => {
    let s = select(EMPTY_SELECTION, order, 'a', 'toggle');
    s = select(s, order, 'c', 'toggle');
    expect(ids(s)).toEqual(['a', 'c']);
    s = select(s, order, 'a', 'toggle');
    expect(ids(s)).toEqual(['c']);
  });

  it('selects a range from the anchor with Shift, in either direction', () => {
    let s = select(EMPTY_SELECTION, order, 'b', 'replace');
    s = select(s, order, 'd', 'range');
    expect(ids(s)).toEqual(['b', 'c', 'd']);
    s = select(s, order, 'a', 'range');
    expect(ids(s)).toEqual(['a', 'b']);
    expect(s.anchor).toBe('b');
  });

  it('treats Shift without an anchor as a plain click', () => {
    expect(ids(select(EMPTY_SELECTION, order, 'c', 'range'))).toEqual(['c']);
  });
});

describe('pruneSelection', () => {
  it('removes ids that are gone and keeps identity when nothing changed', () => {
    const s = { ids: new Set(['a', 'c']), anchor: 'c' };
    expect(pruneSelection(s, order)).toBe(s);
    const pruned = pruneSelection(s, ['a', 'b']);
    expect(ids(pruned)).toEqual(['a']);
    expect(pruned.anchor).toBeNull();
  });
});
