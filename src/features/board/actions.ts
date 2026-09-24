import type { InsertionPoint } from '@/layout/hitTest';
import { boardContent, createItem, insertItems, layoutState, type Board, type ID, type ImageAsset } from '@/model';
import { useEditor } from '@/store/editorStore';
import { useLibrary } from '@/store/libraryStore';
import { useBoard } from '@/store/boardStore';
import { useUpload } from '@/store/uploadStore';

/** "The end" of a wall: the last section when there are sections, otherwise the list end. */
export function endOfBoard(board: Board): InsertionPoint {
  const monthDividers = layoutState(board, 'masonry').params.monthDividers;
  const last = board.sections[board.sections.length - 1];
  return { index: board.items.length, sectionId: monthDividers ? undefined : last?.id };
}

export function imageItem(assetId: ID) {
  return createItem({ kind: 'image', assetId });
}

export function addAssetsToBoard(assetIds: ID[], at?: InsertionPoint): void {
  if (!assetIds.length) return;
  useBoard.getState().update((board) => {
    const point = at ?? endOfBoard(board);
    insertItems(board, assetIds.map(imageItem), point.index, point.sectionId);
  });
}

export function addQuotesToBoard(quoteIds: ID[], at?: InsertionPoint): void {
  if (!quoteIds.length) return;
  useBoard.getState().update((board) => {
    const point = at ?? endOfBoard(board);
    insertItems(board, quoteIds.map((quoteId) => createItem({ kind: 'quote', quoteId })), point.index, point.sectionId);
  });
}

/** A local text card (title or note) at the end, selected so it can be typed into. */
export function addTextCard(text: string): ID | undefined {
  const item = createItem({ kind: 'text', text });
  useBoard.getState().update((board) => {
    const point = endOfBoard(board);
    insertItems(board, [item], point.index, point.sectionId);
  });
  useEditor.getState().select([item.id], item.id);
  return item.id;
}

/** A random quote that is not on this board yet (any quote if all are used). */
export function pickRandomQuote(random = Math.random): ID | undefined {
  const board = useBoard.getState().board;
  const quotes = useLibrary.getState().quotes;
  if (!board || !quotes.length) return undefined;
  const used = new Set(boardContent(board).quoteIds);
  const unused = quotes.filter((q) => !used.has(q.id));
  const pool = unused.length ? unused : quotes;
  return pool[Math.floor(random() * pool.length)]!.id;
}

/** Uploads files into the library and places each image on the board as it arrives. */
export function uploadToBoard(files: File[], at?: InsertionPoint): void {
  let placed = 0;
  useUpload.getState().start(files, {
    onAsset: (asset: ImageAsset) => {
      const board = useBoard.getState().board;
      if (!board) return;
      const point = at ?? endOfBoard(board);
      addAssetsToBoard([asset.id], { index: point.index + (at ? placed : 0), sectionId: point.sectionId });
      placed += 1;
    },
  });
}
