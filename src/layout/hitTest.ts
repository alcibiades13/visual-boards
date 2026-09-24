import type { BoardItem, ID } from '@/model';
import { MONTH_PREFIX } from './masonry';
import type { ComputedLayout } from './types';

export interface InsertionPoint {
  /** Index in the item list the layout was computed from. */
  index: number;
  /** Target section; undefined = unsectioned. Ignored with month dividers. */
  sectionId?: ID;
}

/**
 * Where a card dropped at (x, y) goes in a flow layout (blueprint §5): the
 * nearest card decides, before it when the pointer is in its upper half.
 * `layout` is what the user sees; cards in `skip` (drop placeholders) are
 * ignored, and the index refers to the list without them.
 */
export function flowInsertionPoint(
  layout: ComputedLayout,
  shown: BoardItem[],
  x: number,
  y: number,
  skip: ReadonlySet<ID> = new Set(),
): InsertionPoint {
  const items = skip.size ? shown.filter((i) => !skip.has(i.id)) : shown;
  const blocks = (layout.blocks ?? []).map((b) => ({ ...b, itemIds: b.itemIds.filter((id) => !skip.has(id)) }));
  if (!blocks.length) return { index: items.length };

  // The block under the pointer; between blocks, the nearer one.
  let block = blocks[0]!;
  let best = Infinity;
  for (const b of blocks) {
    const d = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0;
    if (d < best) {
      best = d;
      block = b;
    }
  }
  const sectionId = block.sectionId?.startsWith(MONTH_PREFIX) ? undefined : block.sectionId;

  const index = new Map(items.map((item, i) => [item.id, i]));
  if (!block.itemIds.length) {
    // Empty section: after the last card of any earlier block keeps the global order tidy.
    const before = blocks.slice(0, blocks.indexOf(block)).flatMap((b) => b.itemIds);
    const last = before[before.length - 1];
    return { index: last === undefined ? 0 : index.get(last)! + 1, sectionId };
  }

  let nearest: ID = block.itemIds[0]!;
  let nearestDist = Infinity;
  for (const id of block.itemIds) {
    const r = layout.rects[id]!;
    const dx = x < r.x ? r.x - x : x > r.x + r.w ? x - (r.x + r.w) : 0;
    const dy = y < r.y ? r.y - y : y > r.y + r.h ? y - (r.y + r.h) : 0;
    const d = Math.hypot(dx, dy);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = id;
    }
  }
  const r = layout.rects[nearest]!;
  const after = y > r.y + r.h / 2;
  return { index: index.get(nearest)! + (after ? 1 : 0), sectionId };
}
