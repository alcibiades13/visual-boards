import { strFromU8, strToU8, unzipSync, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { ID } from '@/model';
import { BACKUP_FORMAT, BACKUP_VERSION, blobPath, BackupFormatError, DATA_FILE, parseManifest, type BackupManifest, type Snapshot } from './format';

// Images are already compressed, so they are stored as-is; only data.json is deflated.
// Output chunks are folded into Blobs as we go, so browsers can page them to disk.

const FOLD_BYTES = 32 * 1024 * 1024;

export async function writeBackupZip(snapshot: Snapshot, exportedAt = new Date().toISOString()): Promise<Blob> {
  const parts: BlobPart[] = [];
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let failure: Error | null = null;
  const fold = () => {
    if (pending.length) parts.push(new Blob(pending as BlobPart[]));
    pending = [];
    pendingBytes = 0;
  };

  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    pending.push(chunk);
    pendingBytes += chunk.length;
    if (pendingBytes > FOLD_BYTES) fold();
  });

  const blobs: BackupManifest['blobs'] = {};
  for (const [id, blob] of snapshot.blobs) {
    const path = blobPath(id, blob.type);
    blobs[id] = { path, type: blob.type };
    const entry = new ZipPassThrough(path);
    zip.add(entry);
    entry.push(new Uint8Array(await blob.arrayBuffer()), true);
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    boards: snapshot.boards,
    assets: snapshot.assets,
    quotes: snapshot.quotes,
    blobs,
  };
  const data = new ZipDeflate(DATA_FILE, { level: 6 });
  zip.add(data);
  data.push(strToU8(JSON.stringify(manifest, null, 2)), true);
  zip.end();
  fold();
  if (failure) throw failure;
  return new Blob(parts, { type: 'application/zip' });
}

export async function readBackupZip(file: Blob): Promise<Snapshot & { exportedAt: string }> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new BackupFormatError('Not a zip file');
  }
  const data = files[DATA_FILE];
  if (!data) throw new BackupFormatError(`Missing ${DATA_FILE}`);
  let json: unknown;
  try {
    json = JSON.parse(strFromU8(data));
  } catch {
    throw new BackupFormatError(`${DATA_FILE} is not valid JSON`);
  }
  const manifest = parseManifest(json);

  const blobs = new Map<ID, Blob>();
  for (const [id, { path, type }] of Object.entries(manifest.blobs)) {
    const bytes = files[path];
    if (bytes) blobs.set(id, new Blob([bytes as BlobPart], { type }));
  }
  // An asset without its image would be broken; leave it out.
  const assets = manifest.assets.filter((a) => blobs.has(a.fullBlobId) && blobs.has(a.thumbBlobId));
  return { boards: manifest.boards, assets, quotes: manifest.quotes, blobs, exportedAt: manifest.exportedAt };
}
