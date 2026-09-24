import type { Board, ID, ImageAsset, Quote } from '@/model';
import type { Snapshot } from '../backup/format';
import type { MergePlan } from '../backup/merge';

// Repository interfaces (blueprint §3). The UI depends only on these, so the
// IndexedDB implementation can later be replaced or backed by a cloud sync.

export interface BoardRepo {
  list(): Promise<Board[]>;
  get(id: ID): Promise<Board | undefined>;
  put(board: Board): Promise<void>;
  delete(id: ID): Promise<void>;
}

export interface AssetRepo {
  list(): Promise<ImageAsset[]>;
  get(id: ID): Promise<ImageAsset | undefined>;
  findByHash(hash: string): Promise<ImageAsset | undefined>;
  /** Stores the asset together with its full and thumbnail blobs atomically. */
  add(asset: ImageAsset, blobs: { full: Blob; thumb: Blob }): Promise<void>;
  update(id: ID, patch: Partial<Omit<ImageAsset, 'id'>>): Promise<void>;
  /** Removes the asset and its blobs. */
  delete(ids: ID[]): Promise<void>;
}

export interface QuoteRepo {
  list(): Promise<Quote[]>;
  get(id: ID): Promise<Quote | undefined>;
  addMany(quotes: Quote[]): Promise<void>;
  update(id: ID, patch: Partial<Omit<Quote, 'id'>>): Promise<void>;
  delete(ids: ID[]): Promise<void>;
}

export interface BlobRepo {
  get(id: ID): Promise<Blob | undefined>;
}

export interface MetaRepo {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

export interface BackupRepo {
  /** Every board, asset, quote and blob. Blobs from IndexedDB are disk-backed, not copied into memory. */
  snapshot(): Promise<Snapshot>;
  isEmpty(): Promise<boolean>;
  /** Clears everything and writes the snapshot, in one transaction: a failure leaves the old data intact. */
  replaceAll(snapshot: Snapshot): Promise<void>;
  /** Writes a merge plan in one transaction. */
  applyMerge(plan: MergePlan, blobs: Map<ID, Blob>): Promise<void>;
}

export interface Repos {
  boards: BoardRepo;
  assets: AssetRepo;
  quotes: QuoteRepo;
  blobs: BlobRepo;
  meta: MetaRepo;
  backup: BackupRepo;
}
