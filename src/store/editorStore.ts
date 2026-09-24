import { create } from 'zustand';
import type { ID } from '@/model';

// UI state of the board editor (not saved, not part of undo).

export type EditorMode = 'edit' | 'view';

/** A quote was dropped onto an image card: over it, or on its back? */
export interface QuoteDropChoice {
  itemId: ID;
  quoteId: ID;
}

interface EditorState {
  mode: EditorMode;
  /** Flip cards currently showing their back (view state only, not saved). */
  flipped: ReadonlySet<ID>;
  quoteDrop: QuoteDropChoice | null;
  selected: ReadonlySet<ID>;
  anchor: ID | null;
  libraryOpen: boolean; // drawer on tablet and phone; sidebar visibility on desktop
  libraryWidth: number;
  settingsOpen: boolean; // inspector sheet on tablet and phone
  setMode(mode: EditorMode): void;
  flip(id: ID): void;
  setQuoteDrop(choice: QuoteDropChoice | null): void;
  select(ids: Iterable<ID>, anchor?: ID | null): void;
  toggle(id: ID): void;
  clear(): void;
  set(patch: Partial<Pick<EditorState, 'libraryOpen' | 'libraryWidth' | 'settingsOpen'>>): void;
}

export const LIBRARY_MIN_WIDTH = 260;
export const LIBRARY_MAX_WIDTH = 560;

export const useEditor = create<EditorState>((set, get) => ({
  mode: 'edit',
  flipped: new Set(),
  quoteDrop: null,
  setMode: (mode) => set({ mode, selected: new Set(), anchor: null, quoteDrop: null }),
  flip: (id) => {
    const flipped = new Set(get().flipped);
    if (flipped.has(id)) flipped.delete(id);
    else flipped.add(id);
    set({ flipped });
  },
  setQuoteDrop: (quoteDrop) => set({ quoteDrop }),
  selected: new Set(),
  anchor: null,
  libraryOpen: true,
  libraryWidth: 340,
  settingsOpen: false,
  select: (ids, anchor = null) => set({ selected: new Set(ids), anchor }),
  toggle: (id) => {
    const selected = new Set(get().selected);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    set({ selected, anchor: id });
  },
  clear: () => set({ selected: new Set(), anchor: null }),
  set: (patch) => set(patch),
}));
