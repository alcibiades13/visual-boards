import type { InsertionPoint } from '@/layout/hitTest';
import { createItem, insertItems, layoutState, type Board, type ID, type ImageAsset } from '@/model';
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
