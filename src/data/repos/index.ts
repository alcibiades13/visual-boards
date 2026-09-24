import { openDatabase } from '../db';
import { createDexieRepos } from './dexie';
import type { Repos } from './types';

export type * from './types';

let instance: Repos | undefined;

/** App-wide repositories. Components import this, never Dexie. */
export function getRepos(): Repos {
  instance ??= createDexieRepos(openDatabase());
  return instance;
}

/** Test hook: swap in repositories backed by another database. */
export function setRepos(repos: Repos | undefined): void {
  instance = repos;
}
