import type { Page } from '@playwright/test';

export interface DbDump {
  boards: { id: string; title: string; updatedAt: string; items: unknown[] }[];
  assets: { id: string; hash: string; fileName: string }[];
  quotes: { id: string; text: string }[];
  blobs: number;
  meta: Record<string, unknown>;
}

/** Reads the whole app database straight from IndexedDB. */
export function dumpDb(page: Page): Promise<DbDump> {
  return page.evaluate(
    () =>
      new Promise<DbDump>((resolve, reject) => {
        const open = indexedDB.open('visual-boards');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(['boards', 'assets', 'quotes', 'blobs', 'meta']);
          const all = (name: string) =>
            new Promise<unknown[]>((res) => {
              const req = tx.objectStore(name).getAll();
              req.onsuccess = () => res(req.result);
            });
          const blobCount = new Promise<number>((res) => {
            const req = tx.objectStore('blobs').count();
            req.onsuccess = () => res(req.result);
          });
          void Promise.all([all('boards'), all('assets'), all('quotes'), blobCount, all('meta')]).then(
            ([boards, assets, quotes, blobs, meta]) => {
              db.close();
              resolve({
                boards: boards as DbDump['boards'],
                assets: assets as DbDump['assets'],
                quotes: quotes as DbDump['quotes'],
                blobs,
                meta: Object.fromEntries((meta as { key: string; value: unknown }[]).map((m) => [m.key, m.value])),
              });
            },
          );
        };
      }),
  );
}

export function setMeta(page: Page, key: string, value: unknown): Promise<void> {
  return page.evaluate(
    ({ key, value }) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('visual-boards');
        open.onsuccess = () => {
          const tx = open.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key, value });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    { key, value },
  );
}
