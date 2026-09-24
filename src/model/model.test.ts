import { describe, expect, it } from 'vitest';
import { buildUsageIndex, createBoard, createItem, migrateBoard, SCHEMA_VERSION, UnsupportedSchemaError } from '.';

describe('createBoard', () => {
  it('applies the preset layout and sections', () => {
    const board = createBoard({ title: 'Autumn 2026', preset: 'moodboard', sectionTitles: ['A', 'B'] });
    expect(board.activeLayout).toBe('freeform');
    expect(board.layouts.freeform?.params.size).toBe('auto');
    expect(board.sections.map((s) => s.title)).toEqual(['A', 'B']);
    expect(board.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('buildUsageIndex', () => {
  it('collects assets and quotes from fronts, backs and overlays', () => {
    const b1 = createBoard({ title: '1' });
    b1.items.push(
      createItem({ kind: 'image', assetId: 'img1', overlay: { source: { quoteId: 'q1' }, position: 'c', effect: 'shadow', intensity: 0.5 } }),
      createItem({ kind: 'image', assetId: 'img2' }, { back: { kind: 'quote', quoteId: 'q2' } }),
    );
    const b2 = createBoard({ title: '2' });
    b2.items.push(createItem({ kind: 'image', assetId: 'img1' }), createItem({ kind: 'text', text: 'x' }));

    const index = buildUsageIndex([b1, b2]);
    expect([...(index.assets.get('img1') ?? [])].sort()).toEqual([b1.id, b2.id].sort());
    expect([...(index.assets.get('img2') ?? [])]).toEqual([b1.id]);
    expect([...(index.quotes.get('q1') ?? [])]).toEqual([b1.id]);
    expect([...(index.quotes.get('q2') ?? [])]).toEqual([b1.id]);
  });
});

describe('migrateBoard', () => {
  it('accepts a current-version board', () => {
    const board = createBoard({ title: 'x' });
    expect(migrateBoard(JSON.parse(JSON.stringify(board)))).toEqual(board);
  });

  it('rejects boards from a newer app', () => {
    const board = { ...createBoard({ title: 'x' }), schemaVersion: SCHEMA_VERSION + 1 };
    expect(() => migrateBoard(board)).toThrow(UnsupportedSchemaError);
  });
});
