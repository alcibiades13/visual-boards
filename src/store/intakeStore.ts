import { create } from 'zustand';

// Where pasted images go besides the library. The board editor registers a
// target while it is open, so a paste lands on the board as well.

interface IntakeState {
  target: ((files: File[]) => void) | null;
  setTarget(target: ((files: File[]) => void) | null): void;
}

export const useIntake = create<IntakeState>((set) => ({
  target: null,
  setTarget: (target) => set({ target }),
}));
