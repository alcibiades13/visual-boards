import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBoard, createImageAsset, createItem, createQuote } from '@/model';
import { openDatabase, type VisualBoardsDB } from '../db';
import { createDexieRepos } from './dexie';
import type { Repos } from './types';

let db: VisualBoardsDB;
let repos: Repos;

beforeEach(async () => {
  db = openDatabase(`test-${Math.random()}`);
  await db.open();
  repos = createDexieRepos(db);
});

afterEach(async () => {
  await db.delete();
});

describe('BoardRepo', () => {
  it('round-trips a board and lists newest first', async () => {
    const a = { ...createBoard({ title: 'A' }), updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...createBoard({ title: 'B', preset: 'vision', sectionTitles: ['Health'] }), updatedAt: '2026-02-01T00:00:00.000Z' };
    b.items.push(createItem({ kind: 'text', text: 'Hello' }));
    await repos.boards.put(a);
    await repos.boards.put(b);

    expect(await repos.boards.get(b.id)).toEqual(b);
    expect((await repos.boards.list()).map((x) => x.title)).toEqual(['B', 'A']);

    await repos.boards.delete(a.id);
    expect(await repos.boards.get(a.id)).toBeUndefined();
  });
});

describe('AssetRepo', () => {
  it('stores blobs with the asset and removes them on delete', async () => {
    const asset = createImageAsset({ fileName: 'x.jpg', width: 10, height: 20, hash: 'h1' });
    await repos.assets.add(asset, { full: new Blob(['full']), thumb: new Blob(['thumb']) });

    expect(await repos.assets.findByHash('h1')).toEqual(asset);
    expect(await (await repos.blobs.get(asset.thumbBlobId))?.text()).toBe('thumb');

    await repos.assets.update(asset.id, { favorite: true });
    expect((await repos.assets.get(asset.id))?.favorite).toBe(true);

    await repos.assets.delete([asset.id]);
    expect(await repos.assets.get(asset.id)).toBeUndefined();
    expect(await repos.blobs.get(asset.fullBlobId)).toBeUndefined();
    expect(await repos.blobs.get(asset.thumbBlobId)).toBeUndefined();
  });

  it('rejects a duplicate hash', async () => {
    const blobs = { full: new Blob(['f']), thumb: new Blob(['t']) };
    await repos.assets.add(createImageAsset({ fileName: 'a', width: 1, height: 1, hash: 'same' }), blobs);
    await expect(
      repos.assets.add(createImageAsset({ fileName: 'b', width: 1, height: 1, hash: 'same' }), blobs),
    ).rejects.toThrow();
    expect(await repos.assets.list()).toHaveLength(1);
  });
});

describe('QuoteRepo', () => {
  it('adds, updates and deletes quotes', async () => {
    const q1 = createQuote('The journey is the thing.', 'Homer');
    const q2 = createQuote('Not all those who wander are lost.');
    await repos.quotes.addMany([q1, q2]);
    expect(await repos.quotes.list()).toHaveLength(2);

    await repos.quotes.update(q2.id, { author: 'Tolkien' });
    expect((await repos.quotes.get(q2.id))?.author).toBe('Tolkien');

    await repos.quotes.delete([q1.id]);
    expect((await repos.quotes.list()).map((q) => q.id)).toEqual([q2.id]);
  });
});

describe('MetaRepo', () => {
  it('stores arbitrary values by key', async () => {
    expect(await repos.meta.get('x')).toBeUndefined();
    await repos.meta.set('x', { n: 1 });
    expect(await repos.meta.get<{ n: number }>('x')).toEqual({ n: 1 });
  });
});
