import { DEFAULT_MASONRY_PARAMS, type BoardItem, type ID, type MasonryParams, type Section } from '@/model';
import type { ComputedLayout, ComputeInput, FlowBlock, LayoutEngine, Rect, SectionHeader } from './types';

// Masonry wall (blueprint §5): JS shortest-column packing with absolute
// positions. Never CSS columns: they fill column by column and break order.

export const HEADER_HEIGHT = 56;
export const EMPTY_SECTION_HEIGHT = 96;
export const SECTION_SPACING = 40;
export const MIN_AUTO_COLUMNS = 2;
export const MAX_AUTO_COLUMNS = 6;
export const MAX_COLUMNS = 8;

export const MONTH_PREFIX = 'month:';

export function effectivePadding(padding: number, viewportWidth: number): number {
  return viewportWidth < 600 ? Math.min(padding, 12) : padding;
}

export function masonryColumns(params: MasonryParams, innerWidth: number, gap: number): number {
  if (params.columns !== 'auto') return Math.max(1, Math.min(MAX_COLUMNS, Math.round(params.columns)));
  const fit = Math.floor((innerWidth + gap) / (params.minColumnWidth + gap));
  return Math.max(MIN_AUTO_COLUMNS, Math.min(MAX_AUTO_COLUMNS, fit));
}

interface Group {
  sectionId?: ID;
  header: boolean;
  items: BoardItem[];
}

export function monthKey(iso: string): string {
  return `${MONTH_PREFIX}${iso.slice(0, 7)}`;
}

/** Splits items into flow blocks: unsectioned first, then sections in order; or months. */
export function flowGroups(items: BoardItem[], sections: Section[], monthDividers: boolean): Group[] {
  if (monthDividers) {
    const months = new Map<string, BoardItem[]>();
    for (const item of items) {
      const key = monthKey(item.addedAt);
      months.set(key, [...(months.get(key) ?? []), item]);
    }
    const sorted = [...months].sort(([a], [b]) => a.localeCompare(b));
    if (!sorted.length) return [{ header: false, items: [] }];
    return sorted.map(([key, list]) => ({ sectionId: key, header: true, items: list }));
  }

  const known = new Set(sections.map((s) => s.id));
  const loose = items.filter((i) => !i.sectionId || !known.has(i.sectionId));
  const groups: Group[] = [];
  if (loose.length || !sections.length) groups.push({ header: false, items: loose });
  for (const section of sections) {
    groups.push({ sectionId: section.id, header: true, items: items.filter((i) => i.sectionId === section.id) });
  }
  return groups;
}

export const masonryEngine: LayoutEngine<MasonryParams> = {
  id: 'masonry',
  family: 'flow',
  defaultParams: DEFAULT_MASONRY_PARAMS,

  compute({ items, sections, measure, params, state, viewportWidth, gap }: ComputeInput<MasonryParams>): ComputedLayout {
    const padding = effectivePadding(params.padding, viewportWidth);
    const inner = Math.max(0, viewportWidth - padding * 2);
    const columns = masonryColumns(params, inner, gap);
    const columnWidth = Math.max(0, (inner - gap * (columns - 1)) / columns);

    const rects: Record<ID, Rect> = {};
    const headers: SectionHeader[] = [];
    const blocks: FlowBlock[] = [];
    let y = padding;
    let z = 0;

    for (const group of flowGroups(items, sections, params.monthDividers)) {
      const top = y;
      if (group.header) {
        headers.push({ sectionId: group.sectionId!, y, h: HEADER_HEIGHT });
        y += HEADER_HEIGHT;
      }
      const heights = new Array<number>(columns).fill(y);

      for (const item of group.items) {
        const span = Math.min(columns, state.overrides[item.id]?.span ?? 1);
        // Shortest run of `span` adjacent columns; leftmost wins ties.
        let col = 0;
        let colTop = Infinity;
        for (let c = 0; c + span <= columns; c++) {
          const t = Math.max(...heights.slice(c, c + span));
          if (t < colTop - 0.01) {
            colTop = t;
            col = c;
          }
        }
        const w = columnWidth * span + gap * (span - 1);
        const h = Math.max(1, measure(item, w));
        rects[item.id] = { x: padding + col * (columnWidth + gap), y: colTop, w, h, rotation: 0, z: z++ };
        for (let c = col; c < col + span; c++) heights[c] = colTop + h + gap;
      }

      const bottom = group.items.length ? Math.max(...heights) - gap : y + (group.header ? EMPTY_SECTION_HEIGHT : 0);
      blocks.push({ sectionId: group.sectionId, top, bottom, itemIds: group.items.map((i) => i.id) });
      y = bottom + SECTION_SPACING;
    }

    const last = blocks[blocks.length - 1];
    return { rects, headers, blocks, width: viewportWidth, height: (last ? last.bottom : 0) + padding };
  },
};
