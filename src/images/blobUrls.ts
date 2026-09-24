import { useEffect, useState } from 'react';
import { getRepos } from '@/data/repos';

// Reference-counted object URLs (blueprint §10: never createObjectURL without
// revoking). A URL is revoked a short while after its last user releases it,
// so scrolling back and forth does not reload images.

const GRACE_MS = 10_000;

interface Entry {
  refs: number;
  promise: Promise<string | undefined>;
  url?: string;
  timer?: ReturnType<typeof setTimeout>;
}

const cache = new Map<string, Entry>();

export function acquireBlobUrl(blobId: string): Promise<string | undefined> {
  let entry = cache.get(blobId);
  if (!entry) {
    const created: Entry = {
      refs: 0,
      promise: getRepos()
        .blobs.get(blobId)
        .then((blob) => {
          if (!blob) return undefined;
          created.url = URL.createObjectURL(blob);
          return created.url;
        }),
    };
    entry = created;
    cache.set(blobId, entry);
  }
  clearTimeout(entry.timer);
  entry.refs += 1;
  return entry.promise;
}

export function releaseBlobUrl(blobId: string): void {
  const entry = cache.get(blobId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  entry.timer = setTimeout(() => {
    if (entry.refs > 0) return;
    cache.delete(blobId);
    void entry.promise.then((url) => url && URL.revokeObjectURL(url));
  }, GRACE_MS);
}

/** Forgets a blob immediately, e.g. after the asset was deleted. */
export function evictBlobUrl(blobId: string): void {
  const entry = cache.get(blobId);
  if (!entry) return;
  cache.delete(blobId);
  clearTimeout(entry.timer);
  void entry.promise.then((url) => url && URL.revokeObjectURL(url));
}

export function useBlobUrl(blobId: string | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(() => (blobId ? cache.get(blobId)?.url : undefined));
  useEffect(() => {
    if (!blobId) return;
    let alive = true;
    void acquireBlobUrl(blobId).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
      releaseBlobUrl(blobId);
    };
  }, [blobId]);
  return blobId ? url : undefined;
}
