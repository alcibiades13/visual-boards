import { migrateBoard, type Board, type ID, type ImageAsset, type Quote } from '@/model';

// Backup file (blueprint §9): one .zip with data.json and an images/ folder.

export const BACKUP_FORMAT = 'visual-boards-backup';
export const BACKUP_VERSION = 1;
export const DATA_FILE = 'data.json';

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  boards: Board[];
  assets: ImageAsset[];
  quotes: Quote[];
  /** blobId -> path inside the zip and its media type */
  blobs: Record<ID, { path: string; type: string }>;
}

/** Everything the app stores, in memory. */
export interface Snapshot {
  boards: Board[];
  assets: ImageAsset[];
  quotes: Quote[];
  blobs: Map<ID, Blob>;
}

const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export function blobPath(id: ID, type: string): string {
  return `images/${id}.${EXTENSIONS[type] ?? 'bin'}`;
}

export class BackupFormatError extends Error {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validates the manifest shape and migrates boards from older schema versions. */
export function parseManifest(json: unknown): BackupManifest {
  if (!isObject(json) || json.format !== BACKUP_FORMAT) throw new BackupFormatError('Not a Visual Boards backup');
  if (typeof json.version !== 'number' || json.version > BACKUP_VERSION) {
    throw new BackupFormatError(`Unsupported backup version ${String(json.version)}`);
  }
  for (const key of ['boards', 'assets', 'quotes'] as const) {
    if (!Array.isArray(json[key])) throw new BackupFormatError(`Missing ${key}`);
  }
  if (!isObject(json.blobs)) throw new BackupFormatError('Missing blobs');
  return {
    ...(json as unknown as BackupManifest),
    boards: (json.boards as unknown[]).map(migrateBoard),
  };
}
