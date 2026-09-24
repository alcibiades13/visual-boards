import { create } from 'zustand';
import type { InsertionPoint } from '@/layout/hitTest';
import type { ID } from '@/model';

// Live drag state shared by the library, the wall and the drag overlay.

export type DragSource = { kind: 'assets'; assetIds: ID[] } | { kind: 'items'; itemIds: ID[] };

interface DragState {
  active: DragSource | null;
  /** Where the dragged cards would land; null while not over the wall. */
  target: InsertionPoint | null;
  /** An OS file (or web image) drag over the wall. */
  native: InsertionPoint | null;
  set(patch: Partial<Pick<DragState, 'active' | 'target' | 'native'>>): void;
}

export const useDrag = create<DragState>((set) => ({
  active: null,
  target: null,
  native: null,
  set: (patch) => set(patch),
}));

type HitTest = (clientX: number, clientY: number) => InsertionPoint | null;
let wallHitTest: HitTest | null = null;

/** The wall registers how to turn a screen point into an insertion point. */
export function setWallHitTest(fn: HitTest | null): void {
  wallHitTest = fn;
}
export function hitWall(clientX: number, clientY: number): InsertionPoint | null {
  return wallHitTest?.(clientX, clientY) ?? null;
}

// A touch drag that ends without moving is really a long press; the click the
// browser fires right after it must not count as a tap.
let suppressUntil = 0;
export function suppressNextClick(): void {
  suppressUntil = performance.now() + 500;
}
export function clickSuppressed(): boolean {
  return performance.now() < suppressUntil;
}
