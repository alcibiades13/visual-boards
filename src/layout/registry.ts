import type { LayoutId, LayoutParams } from '@/model';
import { masonryEngine } from './masonry';
import type { LayoutEngine } from './types';

// New layout = new engine file registered here; the editor does not change.
const engines: Partial<Record<LayoutId, LayoutEngine>> = {
  masonry: masonryEngine as unknown as LayoutEngine,
};

/** The engine for a layout id; layouts that do not exist yet fall back to masonry. */
export function getEngine(id: LayoutId): LayoutEngine<LayoutParams> {
  return engines[id] ?? (masonryEngine as unknown as LayoutEngine);
}

export function hasEngine(id: LayoutId): boolean {
  return id in engines;
}
