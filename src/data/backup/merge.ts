import { quoteKey } from '@/import/quoteParser';
import type { Board, Face, ID, ImageAsset, Quote } from '@/model';

// Merging a backup into existing data (pure). Images are matched by content
// hash and quotes by normalized text, so importing the same backup twice, or a
// backup from another device, does not create duplicates. Board references are
// rewritten to the ids that already exist.

export interface MergePlan {
  assets: ImageAsset[]; // new assets to add
  quotes: Quote[]; // new quotes to add
  boards: Board[]; // boards to write (new, or newer than the local copy)
  blobIds: ID[]; // blobs needed by the new assets
}

export interface Existing {
  assets: ImageAsset[];
  quotes: Quote[];
  boards: Board[];
}

function remapFace(face: Face, assetMap: Map<ID, ID>, quoteMap: Map<ID, ID>): Face {
  if (face.kind === 'image') {
    const next = { ...face, assetId: assetMap.get(face.assetId) ?? face.assetId };
    if (face.overlay && 'quoteId' in face.overlay.source) {
      const quoteId = face.overlay.source.quoteId;
      next.overlay = { ...face.overlay, source: { quoteId: quoteMap.get(quoteId) ?? quoteId } };
    }
    return next;
  }
  if (face.kind === 'quote') return { ...face, quoteId: quoteMap.get(face.quoteId) ?? face.quoteId };
  return face;
}

export function remapBoard(board: Board, assetMap: Map<ID, ID>, quoteMap: Map<ID, ID>): Board {
  if (!assetMap.size && !quoteMap.size) return board;
  const background = board.theme.background;
  return {
    ...board,
    theme: {
      ...board.theme,
      background:
        background.kind === 'image'
          ? { kind: 'image', assetId: assetMap.get(background.assetId) ?? background.assetId }
          : background,
    },
    items: board.items.map((item) => ({
      ...item,
      front: remapFace(item.front, assetMap, quoteMap),
      ...(item.back ? { back: remapFace(item.back, assetMap, quoteMap) } : {}),
    })),
  };
}

export function planMerge(existing: Existing, incoming: Existing): MergePlan {
  const assetsById = new Set(existing.assets.map((a) => a.id));
  const assetsByHash = new Map(existing.assets.map((a) => [a.hash, a.id]));
  const assetMap = new Map<ID, ID>();
  const assets: ImageAsset[] = [];
  for (const asset of incoming.assets) {
    if (assetsById.has(asset.id)) continue;
    const same = assetsByHash.get(asset.hash);
    if (same) {
      assetMap.set(asset.id, same);
      continue;
    }
    assets.push(asset);
    assetsById.add(asset.id);
    assetsByHash.set(asset.hash, asset.id);
  }

  const quotesById = new Set(existing.quotes.map((q) => q.id));
  const quotesByText = new Map(existing.quotes.map((q) => [quoteKey(q.text), q.id]));
  const quoteMap = new Map<ID, ID>();
  const quotes: Quote[] = [];
  for (const quote of incoming.quotes) {
    if (quotesById.has(quote.id)) continue;
    const same = quotesByText.get(quoteKey(quote.text));
    if (same) {
      quoteMap.set(quote.id, same);
      continue;
    }
    quotes.push(quote);
    quotesById.add(quote.id);
    quotesByText.set(quoteKey(quote.text), quote.id);
  }

  const localBoards = new Map(existing.boards.map((b) => [b.id, b]));
  const boards = incoming.boards
    .filter((b) => {
      const local = localBoards.get(b.id);
      return !local || b.updatedAt > local.updatedAt; // same board on both sides: newest wins
    })
    .map((b) => remapBoard(b, assetMap, quoteMap));

  return { assets, quotes, boards, blobIds: assets.flatMap((a) => [a.fullBlobId, a.thumbBlobId]) };
}
