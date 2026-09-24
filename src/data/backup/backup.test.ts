import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBoard, createImageAsset, createItem, createQuote, SCHEMA_VERSION, type Board, type ImageAsset, type Quote } from '@/model';
import { openDatabase, type VisualBoardsDB } from '../db';
import { createDexieRepos } from '../repos/dexie';
import type { Repos } from '../repos/types';
import type { Snapshot } from './format';
import { planMerge } from './merge';
import { shouldRemindBackup } from './reminder';
import { readBackupZip, writeBackupZip } from './zip';

const FIXTURE = 'tests/fixtures/backup-v1.zip';

const dbs: VisualBoardsDB[] = [];
async function freshRepos(): Promise<Repos> {
  const db = openDatabase(`backup-${Math.random()}`);
  await db.open();
  dbs.push(db);
  return createDexieRepos(db);
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()));
});

function image(name: string, hash: string, type = 'image/webp'): { asset: ImageAsset; full: Blob; thumb: Blob } {
  const asset = createImageAsset({ fileName: name, width: 400, height: 300, hash });
  return { asset, full: new Blob([`full-${name}`], { type }), thumb: new Blob([`thumb-${name}`], { type }) };
}

async function seed(repos: Repos) {
  const a = image('a.jpg', 'hash-a');
  const b = image('b.jpg', 'hash-b', 'image/jpeg');
  await repos.assets.add(a.asset, a);
  await repos.assets.add(b.asset, b);
  const q1 = createQuote('The journey is the thing.', 'Homer');
  const q2 = createQuote('Not all those who wander are lost.');
  await repos.quotes.addMany([q1, q2]);
  const board = createBoard({ title: 'Autumn 2026', preset: 'vision', sectionTitles: ['Health'] });
  board.items.push(
    createItem({ kind: 'image', assetId: a.asset.id, overlay: { source: { quoteId: q1.id }, position: 'bc', effect: 'dark-gradient', intensity: 0.6 } }),
    createItem({ kind: 'image', assetId: b.asset.id }, { back: { kind: 'quote', quoteId: q2.id }, caption: 'Kyoto' }),
    createItem({ kind: 'text', text: 'Autumn' }),
  );
  await repos.boards.put(board);
  await repos.boards.put(createBoard({ title: 'Empty' }));
  return { a, b, q1, q2, board };
}

async function comparable(snapshot: Snapshot) {
  const blobs: Record<string, { type: string; text: string }> = {};
  for (const [id, blob] of snapshot.blobs) blobs[id] = { type: blob.type, text: await blob.text() };
  const byId = <T extends { id: string }>(list: T[]) => [...list].sort((x, y) => x.id.localeCompare(y.id));
  return { boards: byId(snapshot.boards), assets: byId(snapshot.assets), quotes: byId(snapshot.quotes), blobs };
}

describe('backup round-trip', () => {
  let source: Repos;
  beforeEach(async () => {
    source = await freshRepos();
  });

  it('export → import into an empty database gives an identical state', async () => {
    await seed(source);
    const zip = await writeBackupZip(await source.backup.snapshot());

    const target = await freshRepos();
    expect(await target.backup.isEmpty()).toBe(true);
    await target.backup.replaceAll(await readBackupZip(zip));

    expect(await comparable(await target.backup.snapshot())).toEqual(await comparable(await source.backup.snapshot()));
  });

  it('replace discards local data, and a broken backup leaves it untouched', async () => {
    await seed(source);
    const zip = await writeBackupZip(await source.backup.snapshot());
    const target = await freshRepos();
    await target.boards.put(createBoard({ title: 'Local only' }));

    await expect(readBackupZip(new Blob(['not a zip']))).rejects.toThrow();
    expect((await target.boards.list()).map((b) => b.title)).toEqual(['Local only']);

    await target.backup.replaceAll(await readBackupZip(zip));
    expect((await target.boards.list()).map((b) => b.title).sort()).toEqual(['Autumn 2026', 'Empty']);
  });

  it('merging the same backup twice adds nothing the second time', async () => {
    await seed(source);
    const incoming = await readBackupZip(await writeBackupZip(await source.backup.snapshot()));
    const target = await freshRepos();
    await target.boards.put(createBoard({ title: 'Local only' }));

    await target.backup.applyMerge(planMerge(await target.backup.snapshot(), incoming), incoming.blobs);
    const once = await comparable(await target.backup.snapshot());
    expect(once.boards).toHaveLength(3);
    expect(once.assets).toHaveLength(2);

    const second = planMerge(await target.backup.snapshot(), incoming);
    expect(second).toEqual({ assets: [], quotes: [], boards: [], blobIds: [] });
  });
});

describe('planMerge', () => {
  it('maps images by hash and quotes by text to existing ids, rewriting board references', () => {
    const localImage = image('local.jpg', 'same-hash').asset;
    const localQuote = createQuote('Carpe diem');
    const remoteImage = image('remote.jpg', 'same-hash').asset;
    const remoteQuote = createQuote('carpe diem!');
    const board = createBoard({ title: 'Remote' });
    board.items.push(
      createItem({ kind: 'image', assetId: remoteImage.id, overlay: { source: { quoteId: remoteQuote.id }, position: 'c', effect: 'none', intensity: 0 } }),
      createItem({ kind: 'quote', quoteId: remoteQuote.id }),
    );
    board.theme.background = { kind: 'image', assetId: remoteImage.id };

    const plan = planMerge(
      { assets: [localImage], quotes: [localQuote], boards: [] },
      { assets: [remoteImage], quotes: [remoteQuote], boards: [board] },
    );
    expect(plan.assets).toEqual([]);
    expect(plan.quotes).toEqual([]);
    const [merged] = plan.boards as [Board];
    expect(merged.theme.background).toEqual({ kind: 'image', assetId: localImage.id });
    expect(merged.items[0]!.front).toMatchObject({ assetId: localImage.id, overlay: { source: { quoteId: localQuote.id } } });
    expect(merged.items[1]!.front).toEqual({ kind: 'quote', quoteId: localQuote.id });
  });

  it('keeps the newer copy of a board that exists on both sides', () => {
    const local = { ...createBoard({ title: 'Local' }), updatedAt: '2026-05-01T00:00:00.000Z' };
    const older = { ...local, title: 'Older', updatedAt: '2026-04-01T00:00:00.000Z' };
    const newer = { ...local, title: 'Newer', updatedAt: '2026-06-01T00:00:00.000Z' };
    const existing = { assets: [], quotes: [] as Quote[], boards: [local] };
    expect(planMerge(existing, { assets: [], quotes: [], boards: [older] }).boards).toEqual([]);
    expect(planMerge(existing, { assets: [], quotes: [], boards: [newer] }).boards).toEqual([newer]);
  });
});

describe('shouldRemindBackup', () => {
  const now = new Date('2026-09-24T12:00:00.000Z');
  it.each([
    ['nothing stored', {}, false],
    ['never backed up, content is new', { firstContentAt: '2026-09-10T00:00:00.000Z', lastChangeAt: '2026-09-20T00:00:00.000Z' }, false],
    ['never backed up, content is old', { firstContentAt: '2026-08-01T00:00:00.000Z', lastChangeAt: '2026-09-20T00:00:00.000Z' }, true],
    ['old backup, changes since', { lastBackupAt: '2026-08-01T00:00:00.000Z', lastChangeAt: '2026-09-20T00:00:00.000Z' }, true],
    ['old backup, no changes since', { lastBackupAt: '2026-08-01T00:00:00.000Z', lastChangeAt: '2026-07-20T00:00:00.000Z' }, false],
    ['recent backup', { lastBackupAt: '2026-09-01T00:00:00.000Z', lastChangeAt: '2026-09-20T00:00:00.000Z' }, false],
    ['snoozed', { lastBackupAt: '2026-08-01T00:00:00.000Z', lastChangeAt: '2026-09-20T00:00:00.000Z', snoozedUntil: '2026-09-30T00:00:00.000Z' }, false],
  ])('%s', (_label, input, expected) => {
    expect(shouldRemindBackup({ now, ...input })).toBe(expected);
  });
});

describe('backup files from older app versions', () => {
  // A committed backup made with schema/backup version 1. When the schema
  // changes, this file must keep loading (blueprint §10).
  it.runIf(existsSync(FIXTURE) && !process.env.WRITE_FIXTURES)('loads backup-v1.zip', async () => {
    const snapshot = await readBackupZip(new Blob([readFileSync(FIXTURE)]));
    expect(snapshot.boards.map((b) => b.title).sort()).toEqual(['Autumn 2026', 'Empty']);
    expect(snapshot.boards.every((b) => b.schemaVersion === SCHEMA_VERSION)).toBe(true);
    expect(snapshot.assets).toHaveLength(3);
    expect(snapshot.quotes).toHaveLength(2);
    const target = await freshRepos();
    await target.backup.replaceAll(snapshot);
    expect(await target.boards.list()).toHaveLength(2);
  });

  // WRITE_FIXTURES=1 npx vitest run backup — regenerates the fixture from real images.
  it.runIf(!!process.env.WRITE_FIXTURES)('writes backup-v1.zip', async () => {
    const repos = await freshRepos();
    const files = ['landscape.jpg', 'rotated-exif6.jpg', 'portrait.png'];
    const assets: ImageAsset[] = [];
    for (const [i, name] of files.entries()) {
      const type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
      const bytes = readFileSync(`tests/fixtures/${name}`);
      const asset = { ...createImageAsset({ fileName: name, width: [400, 300, 300][i]!, height: [300, 600, 450][i]!, hash: `fixture-${name}` }), createdAt: `2026-09-0${i + 1}T10:00:00.000Z` };
      await repos.assets.add(asset, { full: new Blob([bytes], { type }), thumb: new Blob([bytes], { type }) });
      assets.push(asset);
    }
    const q1 = { ...createQuote('The journey is the thing.', 'Homer'), createdAt: '2026-09-01T10:00:00.000Z' };
    const q2 = { ...createQuote('Not all those who wander are lost.', 'J. R. R. Tolkien'), createdAt: '2026-09-01T10:00:01.000Z' };
    await repos.quotes.addMany([q1, q2]);
    const board = { ...createBoard({ title: 'Autumn 2026', preset: 'wall' }), updatedAt: '2026-09-20T10:00:00.000Z' };
    board.items.push(
      ...assets.map((a) => createItem({ kind: 'image', assetId: a.id })),
      createItem({ kind: 'quote', quoteId: q1.id }),
      createItem({ kind: 'image', assetId: assets[0]!.id }, { back: { kind: 'quote', quoteId: q2.id } }),
    );
    await repos.boards.put(board);
    await repos.boards.put({ ...createBoard({ title: 'Empty' }), updatedAt: '2026-09-10T10:00:00.000Z' });
    const zip = await writeBackupZip(await repos.backup.snapshot(), '2026-09-24T10:00:00.000Z');
    writeFileSync(FIXTURE, new Uint8Array(await zip.arrayBuffer()));
  });
});
