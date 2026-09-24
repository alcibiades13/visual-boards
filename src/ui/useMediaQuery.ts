import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

/** Desktop editor layout (blueprint §8): library, board and inspector side by side. */
export const DESKTOP = '(min-width: 1200px)';
export const PHONE = '(max-width: 767px)';
