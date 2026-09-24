import type { ImageAsset } from '@/model';
import type { LibraryFilter, LibrarySort } from '@/store/libraryViewStore';

export function sortAssets(assets: ImageAsset[], filter: LibraryFilter, sort: LibrarySort): ImageAsset[] {
  const list = filter === 'favorites' ? assets.filter((a) => a.favorite) : [...assets];
  switch (sort) {
    case 'newest':
      return list.reverse(); // store keeps upload order, oldest first
    case 'oldest':
      return list;
    case 'name':
      return list.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
  }
}
