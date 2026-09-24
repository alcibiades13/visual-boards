import { useMemo } from 'react';
import { useLibrary } from '@/store/libraryStore';
import type { Lookup } from './measure';

/** Library assets and quotes by id, rebuilt only when the library changes. */
export function useLookup(): Lookup {
  const assets = useLibrary((s) => s.assets);
  const quotes = useLibrary((s) => s.quotes);
  return useMemo(
    () => ({ assets: new Map(assets.map((a) => [a.id, a])), quotes: new Map(quotes.map((q) => [q.id, q])) }),
    [assets, quotes],
  );
}
