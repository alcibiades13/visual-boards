import type { ImageAsset } from '@/model';
import type { LibraryFilter, LibrarySort } from '@/store/libraryViewStore';

export function sortAssets(
  assets: ImageAsset[],
  filter: LibraryFilter,
  sort: LibrarySort,
  onBoard?: ReadonlySet<string>,
): ImageAsset[] {
  const list =
    filter === 'favorites'
      ? assets.filter((a) => a.favorite)
      : filter === 'unused' && onBoard
        ? assets.filter((a) => !onBoard.has(a.id))
        : [...assets];
  switch (sort) {
    case 'newest':
      return list.reverse(); // store keeps upload order, oldest first
    case 'oldest':
      return list;
    case 'name':
      return list.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
  }
}
