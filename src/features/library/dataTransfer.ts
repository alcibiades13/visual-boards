// Turns a drop or paste into image files: plain files, whole folders
// (webkitGetAsEntry) and images dragged from another browser tab.

function readEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => (entry as FileSystemFileEntry).file((f) => resolve([f]), () => resolve([])));
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    return new Promise((resolve) => {
      const all: FileSystemEntry[] = [];
      // readEntries returns results in chunks (100 in Chrome) until an empty batch.
      const next = () =>
        reader.readEntries(
          (batch) => {
            if (!batch.length) {
              void Promise.all(all.map(readEntry)).then((lists) => resolve(lists.flat()));
              return;
            }
            all.push(...batch);
            next();
          },
          () => resolve([]),
        );
      next();
    });
  }
  return Promise.resolve([]);
}

export function hasFiles(dt: DataTransfer | null): boolean {
  return !!dt && Array.from(dt.types).includes('Files');
}

/** True when a drag carries something we may turn into an image (files or a web image). */
export function isImageDrag(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  const types = Array.from(dt.types);
  return types.includes('Files') || types.includes('text/uri-list') || types.includes('text/html');
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  // Entries must be read synchronously inside the event handler, before any await.
  const entries = Array.from(dt.items ?? [])
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  const plain = Array.from(dt.files);

  if (entries.some((e) => e.isDirectory)) {
    return (await Promise.all(entries.map(readEntry))).flat();
  }
  return plain;
}

/** The image URL of something dragged from another page, if any. */
export function remoteImageUrl(dt: DataTransfer): string | null {
  const html = dt.getData('text/html');
  if (html) {
    const src = /<img[^>]+src=["']([^"']+)["']/i.exec(html)?.[1];
    if (src) return src.replaceAll('&amp;', '&');
  }
  const uri = dt
    .getData('text/uri-list')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  return uri ?? null;
}

export class RemoteFetchError extends Error {}

/** Downloads a dragged web image. Fails (CORS, not an image) with RemoteFetchError. */
export async function fetchRemoteImage(url: string): Promise<File> {
  let response: Response;
  try {
    response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  } catch {
    throw new RemoteFetchError(url);
  }
  const blob = await response.blob();
  if (!response.ok || !blob.type.startsWith('image/')) throw new RemoteFetchError(url);
  const name = decodeURIComponent(new URL(url, location.href).pathname.split('/').pop() || 'image');
  return new File([blob], name, { type: blob.type });
}
