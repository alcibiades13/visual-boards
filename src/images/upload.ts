import { getRepos } from '@/data/repos';
import { createImageAsset, type ImageAsset } from '@/model';
import { sha256Hex } from './hash';
import { getImagePool } from './pool';
import { DecodeError, type ProcessedImage } from './process';
import { isHeicBytes } from './sniff';

// Upload pipeline (blueprint §7): hash → dedupe → [HEIC → JPEG] → worker
// (orientation, resize, thumbnail) → IndexedDB. Each image is reported as
// soon as it is stored, not at the end of the batch.

export type UploadOutcome =
  | { kind: 'added'; asset: ImageAsset }
  | { kind: 'duplicate'; fileName: string; existing?: ImageAsset }
  | { kind: 'failed'; fileName: string; reason: string }
  | { kind: 'cancelled'; fileName: string };

const PARALLEL = 4;

async function convertHeic(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import('heic2any');
  const result = await heic2any({ blob, toType: 'image/jpeg', quality: 0.92 });
  return Array.isArray(result) ? result[0]! : result;
}

async function decode(file: Blob, heic: boolean): Promise<ProcessedImage> {
  const pool = getImagePool();
  try {
    return await pool.process(file); // Safari decodes HEIC natively
  } catch (error) {
    if (!(error instanceof DecodeError) || !heic) throw error;
    return pool.process(await convertHeic(file));
  }
}

export interface UploadContext {
  signal: AbortSignal;
  /** Hashes already seen in this session, shared across overlapping uploads. */
  seen: Set<string>;
}

async function uploadOne(file: File, ctx: UploadContext): Promise<UploadOutcome> {
  const fileName = file.name || 'image';
  if (ctx.signal.aborted) return { kind: 'cancelled', fileName };
  try {
    const bytes = await file.arrayBuffer();
    const hash = await sha256Hex(bytes);
    const repo = getRepos().assets;
    if (ctx.seen.has(hash)) return { kind: 'duplicate', fileName };
    const existing = await repo.findByHash(hash);
    if (existing) return { kind: 'duplicate', fileName, existing };
    ctx.seen.add(hash);
    if (ctx.signal.aborted) {
      ctx.seen.delete(hash);
      return { kind: 'cancelled', fileName };
    }

    const heic = isHeicBytes(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)));
    const processed = await decode(file, heic);
    if (ctx.signal.aborted) {
      ctx.seen.delete(hash);
      return { kind: 'cancelled', fileName };
    }
    const asset = createImageAsset({ fileName, width: processed.width, height: processed.height, hash });
    try {
      await repo.add(asset, { full: processed.full, thumb: processed.thumb });
    } catch (error) {
      if (error instanceof Error && error.name === 'ConstraintError') return { kind: 'duplicate', fileName };
      throw error;
    }
    return { kind: 'added', asset };
  } catch (error) {
    const reason = error instanceof DecodeError ? 'decode' : error instanceof Error ? error.message : String(error);
    return { kind: 'failed', fileName, reason };
  }
}

/** Uploads files with bounded parallelism, reporting each outcome as it happens. */
export async function uploadImages(
  files: File[],
  ctx: UploadContext,
  onOutcome: (outcome: UploadOutcome) => void,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < files.length) {
      const file = files[next++]!;
      onOutcome(await uploadOne(file, ctx));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, lane));
}
