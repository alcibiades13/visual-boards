import { createLayoutState, newId } from './defaults';
import type { Board, BoardItem, ID, LayoutId, LayoutParamsMap, LayoutState } from './types';

// Board edits as plain mutations. They run inside boardStore.update() on an
// Immer draft, and in tests on produce(). Content order lives in board.items;
// per-layout data lives in board.layouts[id] and is never touched by another layout.

export function layoutState<K extends LayoutId>(board: Board, id: K): LayoutState<LayoutParamsMap[K]> {
  // Correlated key/value types are beyond TypeScript here; the map is keyed by id.
  const layouts = board.layouts as Partial<Record<LayoutId, LayoutState<LayoutParamsMap[K]>>>;
  let state = layouts[id];
  if (!state) {
    state = createLayoutState(id);
    layouts[id] = state;
  }
  return state;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(length, Math.round(index)));
}

/** Inserts new cards at `index`, all in `sectionId`. */
export function insertItems(board: Board, items: BoardItem[], index: number, sectionId?: ID): void {
  const placed = items.map((item) => {
    const copy = { ...item };
    if (sectionId) copy.sectionId = sectionId;
    else delete copy.sectionId;
    return copy;
  });
  board.items.splice(clampIndex(index, board.items.length), 0, ...placed);
}

/**
 * Moves cards so they end up at `index` of the list *without* them (that is the
 * list the drop position was computed on). Their relative order is kept.
 * `sectionId: null` keeps each card's current section (month dividers).
 */
export function moveItems(board: Board, ids: ID[], index: number, sectionId: ID | undefined | null): void {
  const moving = new Set(ids);
  const moved = board.items.filter((i) => moving.has(i.id));
  const rest = board.items.filter((i) => !moving.has(i.id));
  for (const item of moved) {
    if (sectionId === null) continue;
    if (sectionId) item.sectionId = sectionId;
    else delete item.sectionId;
  }
  rest.splice(clampIndex(index, rest.length), 0, ...moved);
  board.items.splice(0, board.items.length, ...rest);
}

/** Removes cards and their per-layout data. */
export function removeItems(board: Board, ids: ID[]): void {
  const gone = new Set(ids);
  board.items = board.items.filter((i) => !gone.has(i.id));
  for (const state of Object.values(board.layouts)) {
    if (!state) continue;
    for (const id of ids) {
      delete state.placements[id];
      delete state.overrides[id];
    }
  }
  if (board.coverItemId && gone.has(board.coverItemId)) delete board.coverItemId;
}

export function setSpan(board: Board, layout: LayoutId, ids: ID[], span: 1 | 2 | 3): void {
  const state = layoutState(board, layout);
  for (const id of ids) {
    if (span === 1) {
      delete state.overrides[id]?.span;
      if (state.overrides[id] && !Object.keys(state.overrides[id]).length) delete state.overrides[id];
    } else {
      state.overrides[id] = { ...state.overrides[id], span };
    }
  }
}

export function addSection(board: Board, title: string): ID {
  const id = newId();
  board.sections.push({ id, title });
  return id;
}

export function renameSection(board: Board, id: ID, title: string): void {
  const section = board.sections.find((s) => s.id === id);
  if (section) section.title = title;
}

/** Deletes a section; its cards stay on the board, unsectioned. */
export function removeSection(board: Board, id: ID): void {
  board.sections = board.sections.filter((s) => s.id !== id);
  for (const item of board.items) if (item.sectionId === id) delete item.sectionId;
}

export function moveSection(board: Board, id: ID, delta: -1 | 1): void {
  const from = board.sections.findIndex((s) => s.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= board.sections.length) return;
  const [section] = board.sections.splice(from, 1);
  board.sections.splice(to, 0, section!);
}
