// Shortest-column packing — the core of every masonry arrangement (blueprint §5).
// Pure: the same input always gives the same output.

export interface PackInput {
  id: string;
  /** Height divided by width of the item's natural size. */
  ratio: number;
  /** Extra fixed height below the scaled part (e.g. a caption). */
  extra?: number;
}

export interface PackedRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackResult {
  rects: PackedRect[];
  height: number;
  columnWidth: number;
}

export function columnCount(width: number, minColumnWidth: number, gap: number, min = 1, max = 12): number {
  const n = Math.floor((width + gap) / (minColumnWidth + gap));
  return Math.max(min, Math.min(max, n));
}

export function packColumns(
  items: readonly PackInput[],
  opts: { width: number; columns: number; gap: number; top?: number },
): PackResult {
  const columns = Math.max(1, Math.floor(opts.columns));
  const { gap } = opts;
  const top = opts.top ?? 0;
  const columnWidth = Math.max(0, (opts.width - gap * (columns - 1)) / columns);
  const heights = new Array<number>(columns).fill(top);
  const rects: PackedRect[] = [];

  for (const item of items) {
    let col = 0;
    for (let c = 1; c < columns; c++) if (heights[c]! < heights[col]!) col = c;
    const h = columnWidth * item.ratio + (item.extra ?? 0);
    const y = heights[col]!;
    rects.push({ id: item.id, x: col * (columnWidth + gap), y, w: columnWidth, h });
    heights[col] = y + h + gap;
  }

  const bottom = Math.max(...heights);
  return { rects, height: rects.length ? bottom - gap : top, columnWidth };
}
