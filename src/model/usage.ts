import type { Board, Face, ID, TextSource } from './types';

// Usage index (blueprint §4): computed from boards, never stored.
export interface UsageIndex {
  assets: Map<ID, Set<ID>>; // assetId -> boardIds
  quotes: Map<ID, Set<ID>>; // quoteId -> boardIds
}

function add(map: Map<ID, Set<ID>>, key: ID, boardId: ID) {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(boardId);
}

function visitSource(source: TextSource, boardId: ID, index: UsageIndex) {
  if ('quoteId' in source) add(index.quotes, source.quoteId, boardId);
}

function visitFace(face: Face, boardId: ID, index: UsageIndex) {
  switch (face.kind) {
    case 'image':
      add(index.assets, face.assetId, boardId);
      if (face.overlay) visitSource(face.overlay.source, boardId, index);
      break;
    case 'quote':
      add(index.quotes, face.quoteId, boardId);
      break;
    case 'text':
      break;
  }
}

export function buildUsageIndex(boards: Iterable<Board>): UsageIndex {
  const index: UsageIndex = { assets: new Map(), quotes: new Map() };
  for (const board of boards) {
    if (board.theme.background.kind === 'image') add(index.assets, board.theme.background.assetId, board.id);
    for (const item of board.items) {
      visitFace(item.front, board.id, index);
      if (item.back) visitFace(item.back, board.id, index);
    }
  }
  return index;
}
