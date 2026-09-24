import { getRepos } from './repos';

const PERSIST_KEY = 'storagePersistRequested';

/**
 * Asks the browser not to evict our data under storage pressure (blueprint §3).
 * Requested once on first run; the result is remembered in the meta table.
 */
export async function requestPersistentStorage(): Promise<boolean | undefined> {
  const meta = getRepos().meta;
  const already = await meta.get<{ granted: boolean }>(PERSIST_KEY);
  if (already) return already.granted;
  if (!navigator.storage?.persist) return undefined;
  const granted = await navigator.storage.persist();
  await meta.set(PERSIST_KEY, { granted, at: new Date().toISOString() });
  return granted;
}
