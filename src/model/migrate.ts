import { SCHEMA_VERSION } from './defaults';
import type { Board } from './types';

// Upgrades a board read from an old backup file to the current schema.
// Each schema bump adds one step here and a test with an old fixture.
type Step = (board: Record<string, unknown>) => Record<string, unknown>;

const steps: Record<number, Step> = {
  // 1 -> 2: add here when the schema changes.
};

export class UnsupportedSchemaError extends Error {
  constructor(version: number) {
    super(`Board schema version ${version} is newer than this app (${SCHEMA_VERSION}).`);
  }
}

export function migrateBoard(raw: unknown): Board {
  if (typeof raw !== 'object' || raw === null) throw new Error('Invalid board data');
  let board = { ...(raw as Record<string, unknown>) };
  let version = typeof board.schemaVersion === 'number' ? board.schemaVersion : 1;
  if (version > SCHEMA_VERSION) throw new UnsupportedSchemaError(version);
  while (version < SCHEMA_VERSION) {
    const step = steps[version];
    if (!step) throw new Error(`Missing migration from schema ${version}`);
    board = step(board);
    version += 1;
  }
  board.schemaVersion = SCHEMA_VERSION;
  return board as unknown as Board;
}
