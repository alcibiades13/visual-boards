import { create } from 'zustand';
import { EMPTY_SELECTION, select, type Selection, type SelectMode } from '@/features/library/selection';

// View state of the library panel. Kept outside the component so it survives
// navigation and is shared once the panel is embedded in the editor.

export type LibraryTab = 'images' | 'quotes';
export type LibraryFilter = 'all' | 'favorites' | 'unused'; // 'unused' = not on the open board
export type LibrarySort = 'newest' | 'oldest' | 'name';
export type ThumbSize = 1 | 2 | 3; // small → large

interface LibraryViewState {
  tab: LibraryTab;
  filter: LibraryFilter;
  sort: LibrarySort;
  size: ThumbSize;
  query: string;
  selection: Selection;
  /** Touch: after a long press, taps toggle instead of acting. */
  selectionMode: boolean;
  set(patch: Partial<Pick<LibraryViewState, 'tab' | 'filter' | 'sort' | 'size' | 'query'>>): void;
  selectItem(order: readonly string[], id: string, mode: SelectMode): void;
  setSelection(ids: Iterable<string>): void;
  clearSelection(): void;
  enterSelectionMode(): void;
}

export const useLibraryView = create<LibraryViewState>((set, get) => ({
  tab: 'images',
  filter: 'all',
  sort: 'newest',
  size: 2,
  query: '',
  selection: EMPTY_SELECTION,
  selectionMode: false,
  set: (patch) => set(patch),
  selectItem: (order, id, mode) => {
    const selection = select(get().selection, order, id, mode);
    set({ selection, selectionMode: get().selectionMode && selection.ids.size > 0 });
  },
  setSelection: (ids) => set({ selection: { ids: new Set(ids), anchor: get().selection.anchor } }),
  clearSelection: () => set({ selection: EMPTY_SELECTION, selectionMode: false }),
  enterSelectionMode: () => set({ selectionMode: true }),
}));
