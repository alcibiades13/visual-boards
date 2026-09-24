import type { VisualBoardsDB } from '../db';
import type { AssetRepo, BlobRepo, BoardRepo, MetaRepo, QuoteRepo, Repos } from './types';

function boardRepo(db: VisualBoardsDB): BoardRepo {
  return {
    list: () => db.boards.orderBy('updatedAt').reverse().toArray(),
    get: (id) => db.boards.get(id),
    put: async (board) => {
      await db.boards.put(board);
    },
    delete: (id) => db.boards.delete(id),
  };
}

function assetRepo(db: VisualBoardsDB): AssetRepo {
  return {
    list: () => db.assets.orderBy('createdAt').toArray(),
    get: (id) => db.assets.get(id),
    findByHash: (hash) => db.assets.where('hash').equals(hash).first(),
    add: (asset, blobs) =>
      db.transaction('rw', db.assets, db.blobs, async () => {
        await db.blobs.bulkPut([
          { id: asset.fullBlobId, blob: blobs.full },
          { id: asset.thumbBlobId, blob: blobs.thumb },
        ]);
        await db.assets.add(asset);
      }),
    update: async (id, patch) => {
      await db.assets.update(id, patch);
    },
    delete: (ids) =>
      db.transaction('rw', db.assets, db.blobs, async () => {
        const assets = await db.assets.bulkGet(ids);
        const blobIds = assets.flatMap((a) => (a ? [a.fullBlobId, a.thumbBlobId] : []));
        await db.blobs.bulkDelete(blobIds);
        await db.assets.bulkDelete(ids);
      }),
  };
}

function quoteRepo(db: VisualBoardsDB): QuoteRepo {
  return {
    list: () => db.quotes.orderBy('createdAt').toArray(),
    get: (id) => db.quotes.get(id),
    addMany: async (quotes) => {
      await db.quotes.bulkAdd(quotes);
    },
    update: async (id, patch) => {
      await db.quotes.update(id, patch);
    },
    delete: (ids) => db.quotes.bulkDelete(ids),
  };
}

function blobRepo(db: VisualBoardsDB): BlobRepo {
  return {
    get: async (id) => (await db.blobs.get(id))?.blob,
  };
}

function metaRepo(db: VisualBoardsDB): MetaRepo {
  return {
    get: async <T>(key: string) => (await db.meta.get(key))?.value as T | undefined,
    set: async (key, value) => {
      await db.meta.put({ key, value });
    },
  };
}

export function createDexieRepos(db: VisualBoardsDB): Repos {
  return {
    boards: boardRepo(db),
    assets: assetRepo(db),
    quotes: quoteRepo(db),
    blobs: blobRepo(db),
    meta: metaRepo(db),
  };
}
