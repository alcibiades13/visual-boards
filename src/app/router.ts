import { useSyncExternalStore } from 'react';

// Minimal hash router: works from any static host and offline as a PWA.
export type Route = { name: 'dashboard' } | { name: 'board'; boardId: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const board = /^\/b\/([^/?#]+)/.exec(path);
  if (board?.[1]) return { name: 'board', boardId: decodeURIComponent(board[1]) };
  return { name: 'dashboard' };
}

export function hrefFor(route: Route): string {
  return route.name === 'board' ? `#/b/${encodeURIComponent(route.boardId)}` : '#/';
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route);
}

function subscribe(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}
