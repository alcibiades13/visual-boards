// Library selection rules (blueprint §7): click, Shift+click range,
// Cmd/Ctrl+click toggle. Pure so it can be unit-tested.

export type SelectMode = 'replace' | 'toggle' | 'range';

export interface Selection {
  ids: ReadonlySet<string>;
  anchor: string | null;
}

export const EMPTY_SELECTION: Selection = { ids: new Set(), anchor: null };

export function select(current: Selection, order: readonly string[], id: string, mode: SelectMode): Selection {
  switch (mode) {
    case 'replace':
      return { ids: new Set([id]), anchor: id };
    case 'toggle': {
      const ids = new Set(current.ids);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { ids, anchor: id };
    }
    case 'range': {
      const from = current.anchor ? order.indexOf(current.anchor) : -1;
      const to = order.indexOf(id);
      if (from < 0 || to < 0) return { ids: new Set([id]), anchor: id };
      const [a, b] = from <= to ? [from, to] : [to, from];
      // The anchor stays put so the range can be adjusted with further Shift+clicks.
      return { ids: new Set(order.slice(a, b + 1)), anchor: current.anchor };
    }
  }
}

/** Drops ids that are no longer visible (deleted or filtered out). */
export function pruneSelection(current: Selection, visible: readonly string[]): Selection {
  const allowed = new Set(visible);
  const ids = new Set([...current.ids].filter((id) => allowed.has(id)));
  if (ids.size === current.ids.size) return current;
  return { ids, anchor: current.anchor && allowed.has(current.anchor) ? current.anchor : null };
}
