import { produce } from 'immer';
import { create } from 'zustand';
import { getRepos } from '@/data/repos';
import { nowIso, type Board, type ID } from '@/model';
import { createSaver } from './autosave';

// The board being edited. Every change goes through update(), which stamps
// updatedAt and schedules an autosave. (Undo/redo via Immer patches: M6.)

type Status = 'idle' | 'loading' | 'ready' | 'missing';

interface BoardState {
  board: Board | null;
  status: Status;
  open(id: ID): Promise<void>;
  close(): Promise<void>;
  update(recipe: (draft: Board) => void): void;
}

const saver = createSaver<Board>(
  (board) => getRepos().boards.put(board),
  500,
  (board) => getRepos().boards.putNow(board),
);

export const useBoard = create<BoardState>((set, get) => ({
  board: null,
  status: 'idle',

  open: async (id) => {
    await saver.flush();
    set({ board: null, status: 'loading' });
    const board = await getRepos().boards.get(id);
    set(board ? { board, status: 'ready' } : { board: null, status: 'missing' });
  },

  close: async () => {
    await saver.flush();
    set({ board: null, status: 'idle' });
  },

  update: (recipe) => {
    const current = get().board;
    if (!current) return;
    const next = produce(current, (draft) => {
      recipe(draft);
      draft.updatedAt = nowIso();
    });
    set({ board: next });
    saver.schedule(next);
  },
}));

/** Writes pending board changes now (e.g. before a backup export). */
export const flushBoard = () => saver.flush();
