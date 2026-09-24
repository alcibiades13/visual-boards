import Dexie, { type EntityTable } from 'dexie';
import type { Board, ID, ImageAsset, Quote } from '@/model';

export interface BlobRecord {
  id: ID;
  blob: Blob;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

export type VisualBoardsDB = Dexie & {
  boards: EntityTable<Board, 'id'>;
  assets: EntityTable<ImageAsset, 'id'>;
  quotes: EntityTable<Quote, 'id'>;
  blobs: EntityTable<BlobRecord, 'id'>;
  meta: EntityTable<MetaRecord, 'key'>;
};

export const DB_NAME = 'visual-boards';

// Every schema change adds a new db.version(n).stores(...).upgrade(...) block
// below the previous ones; never edit an existing version.
export function openDatabase(name = DB_NAME): VisualBoardsDB {
  const db = new Dexie(name) as VisualBoardsDB;
  db.version(1).stores({
    boards: 'id, updatedAt',
    assets: 'id, &hash, createdAt, fileName, favorite',
    quotes: 'id, createdAt, favorite',
    blobs: 'id',
    meta: 'key',
  });
  return db;
}
