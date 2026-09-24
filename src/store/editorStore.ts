import { create } from 'zustand';
import type { ID } from '@/model';

// UI state of the board editor (not saved, not part of undo).

interface EditorState {
  selected: ReadonlySet<ID>;
  anchor: ID | null;
  libraryOpen: boolean; // drawer on tablet and phone; sidebar visibility on desktop
  libraryWidth: number;
  settingsOpen: boolean; // inspector sheet on tablet and phone
  select(ids: Iterable<ID>, anchor?: ID | null): void;
  toggle(id: ID): void;
  clear(): void;
  set(patch: Partial<Pick<EditorState, 'libraryOpen' | 'libraryWidth' | 'settingsOpen'>>): void;
}

export const LIBRARY_MIN_WIDTH = 260;
export const LIBRARY_MAX_WIDTH = 560;

export const useEditor = create<EditorState>((set, get) => ({
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
