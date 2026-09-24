import { create } from 'zustand';
import { getRepos } from '@/data/repos';
import { evictBlobUrl } from '@/images/blobUrls';
import { buildUsageIndex, type ID, type ImageAsset, type Quote } from '@/model';

// The library is shared by all boards and is not part of board undo history.

interface LibraryState {
  loaded: boolean;
  assets: ImageAsset[]; // oldest first
  quotes: Quote[]; // oldest first
  load(): Promise<void>;
  assetAdded(asset: ImageAsset): void;
  setAssetsFavorite(ids: ID[], favorite: boolean): Promise<void>;
  deleteAssets(ids: ID[]): Promise<void>;
  addQuotes(quotes: Quote[]): Promise<void>;
  setQuoteFavorite(id: ID, favorite: boolean): Promise<void>;
  deleteQuotes(ids: ID[]): Promise<void>;
}

export const useLibrary = create<LibraryState>((set, get) => ({
  loaded: false,
  assets: [],
  quotes: [],

  load: async () => {
    const repos = getRepos();
    const [assets, quotes] = await Promise.all([repos.assets.list(), repos.quotes.list()]);
    set({ assets, quotes, loaded: true });
  },

  assetAdded: (asset) => set({ assets: [...get().assets, asset] }),

  setAssetsFavorite: async (ids, favorite) => {
    const idSet = new Set(ids);
    set({ assets: get().assets.map((a) => (idSet.has(a.id) ? { ...a, favorite } : a)) });
    await Promise.all(ids.map((id) => getRepos().assets.update(id, { favorite })));
  },

  deleteAssets: async (ids) => {
    const idSet = new Set(ids);
    const removed = get().assets.filter((a) => idSet.has(a.id));
    await getRepos().assets.delete(ids);
    for (const a of removed) {
      evictBlobUrl(a.thumbBlobId);
      evictBlobUrl(a.fullBlobId);
    }
    set({ assets: get().assets.filter((a) => !idSet.has(a.id)) });
  },

  addQuotes: async (quotes) => {
    await getRepos().quotes.addMany(quotes);
    set({ quotes: [...get().quotes, ...quotes] });
  },

  setQuoteFavorite: async (id, favorite) => {
    set({ quotes: get().quotes.map((q) => (q.id === id ? { ...q, favorite } : q)) });
    await getRepos().quotes.update(id, { favorite });
  },

  deleteQuotes: async (ids) => {
    const idSet = new Set(ids);
    await getRepos().quotes.delete(ids);
    set({ quotes: get().quotes.filter((q) => !idSet.has(q.id)) });
  },
}));

/** How many boards use the given assets/quotes — for delete confirmations. */
export async function countBoardsUsing(ids: { assets?: ID[]; quotes?: ID[] }): Promise<{ boards: number; items: number }> {
  const index = buildUsageIndex(await getRepos().boards.list());
  const boards = new Set<ID>();
  let items = 0;
  for (const [list, map] of [
    [ids.assets ?? [], index.assets],
    [ids.quotes ?? [], index.quotes],
  ] as const) {
    for (const id of list) {
      const used = map.get(id);
      if (used?.size) {
        items += 1;
        used.forEach((b) => boards.add(b));
      }
    }
  }
  return { boards: boards.size, items };
}
