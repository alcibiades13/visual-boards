import { newId, nowIso } from './defaults';
import type { Board, Face, ID } from './types';

/** Distinct library images and quotes used on a board (fronts, backs and overlays). */
export function boardContent(board: Board): { assetIds: ID[]; quoteIds: ID[] } {
  const assets = new Set<ID>();
  const quotes = new Set<ID>();
  const visit = (face: Face | undefined) => {
    if (!face) return;
    if (face.kind === 'image') {
      assets.add(face.assetId);
      if (face.overlay && 'quoteId' in face.overlay.source) quotes.add(face.overlay.source.quoteId);
    } else if (face.kind === 'quote') {
      quotes.add(face.quoteId);
    }
  };
  for (const item of board.items) {
    visit(item.front);
    visit(item.back);
  }
  return { assetIds: [...assets], quoteIds: [...quotes] };
}

/**
 * Images for the dashboard card: the chosen cover, otherwise the first four
 * image cards in board order.
 */
export function coverAssetIds(board: Board): ID[] {
  const cover = board.coverItemId && board.items.find((i) => i.id === board.coverItemId);
  if (cover && cover.front.kind === 'image') return [cover.front.assetId];
  const ids: ID[] = [];
  for (const item of board.items) {
    if (item.front.kind === 'image' && !ids.includes(item.front.assetId)) ids.push(item.front.assetId);
    if (ids.length === 4) break;
  }
  return ids;
}

/** A full copy with a new id. Item ids stay: they only need to be unique within a board. */
export function duplicateBoard(board: Board, title: string): Board {
  const now = nowIso();
  return { ...structuredClone(board), id: newId(), title, createdAt: now, updatedAt: now };
}
