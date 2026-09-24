import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { dumpDb, setMeta } from './helpers';

const cards = (page: Page) => page.getByTestId('board-card');
const card = (page: Page, title: string) => cards(page).filter({ has: page.getByRole('heading', { name: title, exact: true }) });

async function createBoard(page: Page, title: string, preset: string) {
  await page.getByRole('button', { name: 'New board' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New board' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill(title);
  await dialog.getByRole('radio', { name: new RegExp(preset) }).click();
  await dialog.getByRole('button', { name: 'Create board' }).click();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue(title);
}

async function importBackup(page: Page, path: string) {
  await page.getByRole('button', { name: 'Backup' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Import backup…' }).click();
  await (await chooser).setFiles(path);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('create, rename, duplicate and delete boards', async ({ page }) => {
  await createBoard(page, 'Autumn 2026', 'Vision Board');
  const board = (await dumpDb(page)).boards[0]!;
  expect(board).toMatchObject({ title: 'Autumn 2026', preset: 'vision', activeLayout: 'masonry' });
  expect((board as unknown as { sections: { title: string }[] }).sections.map((s) => s.title)).toEqual([
    'Health', 'Travel', 'Work', 'Relationships', 'Creativity', 'Home',
  ]);

  await page.getByRole('link', { name: 'Boards' }).click();
  await expect(card(page, 'Autumn 2026')).toContainText('edited');

  await card(page, 'Autumn 2026').getByRole('button', { name: 'Board options' }).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const input = cards(page).getByRole('textbox', { name: 'Board name' });
  await input.fill('Jesen 2026');
  await input.press('Enter');
  await expect(card(page, 'Jesen 2026')).toBeVisible();

  await card(page, 'Jesen 2026').getByRole('button', { name: 'Board options' }).click();
  await page.getByRole('menuitem', { name: 'Duplicate' }).click();
  await expect(card(page, 'Jesen 2026 (copy)')).toBeVisible();
  await expect(cards(page)).toHaveCount(2);

  await card(page, 'Jesen 2026 (copy)').getByRole('button', { name: 'Board options' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(cards(page)).toHaveCount(1);

  await page.reload();
  await expect(card(page, 'Jesen 2026')).toBeVisible();
});

test('a title change survives closing the tab right away', async ({ page, context }) => {
  await createBoard(page, 'Draft', 'Blank');
  const url = page.url();
  await page.getByRole('textbox', { name: 'Board name' }).fill('Saved on close');
  await page.close({ runBeforeUnload: true });

  const again = await context.newPage();
  await again.goto(url);
  await expect(again.getByRole('textbox', { name: 'Board name' })).toHaveValue('Saved on close');
});

test('a change survives an immediate reload', async ({ page }) => {
  await createBoard(page, 'Draft', 'Blank');
  await page.getByRole('textbox', { name: 'Board name' }).fill('Saved on reload');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Board name' })).toHaveValue('Saved on reload');
});

test('backup: import into an empty app, export, and import again gives an identical state', async ({ page, browser }) => {
  await importBackup(page, 'tests/fixtures/backup-v1.zip');
  await expect(page.getByRole('status').filter({ hasText: 'Imported 2 boards, 3 images and 2 quotes.' })).toBeVisible();
  await expect(cards(page)).toHaveCount(2);
  const autumn = card(page, 'Autumn 2026');
  await expect(autumn).toContainText('3 images · 2 quotes');
  await expect(autumn.locator('img')).toHaveCount(1); // first image as cover (fewer than 4 distinct)
  await expect(autumn.locator('img')).toHaveJSProperty('complete', true);

  const before = await dumpDb(page);
  await page.getByRole('button', { name: 'Backup' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Export everything' }).click();
  const file = await (await download).path();
  expect((await download).suggestedFilename()).toMatch(/^visual-boards-backup-\d{4}-\d{2}-\d{2}\.zip$/);

  // A brand-new browser profile = an empty app.
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto('/');
  await importBackup(other, file);
  await expect(cards(other)).toHaveCount(2);
  const after = await dumpDb(other);
  const strip = ({ meta: _meta, ...rest }: typeof before) => rest;
  expect(strip(after)).toEqual(strip(before));
  await fresh.close();

  // Importing into a non-empty app asks first; merging the same backup adds nothing.
  await importBackup(page, file);
  const dialog = page.getByRole('dialog', { name: 'Import backup' });
  await dialog.getByRole('button', { name: 'Merge' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Imported 0 boards, 0 images and 0 quotes.' })).toBeVisible();
  expect(strip(await dumpDb(page))).toEqual(strip(before));

  // Replace discards local-only boards.
  await createBoard(page, 'Local only', 'Blank');
  await page.goto('/');
  await importBackup(page, file);
  await page.getByRole('dialog', { name: 'Import backup' }).getByRole('button', { name: 'Replace everything' }).click();
  await expect(cards(page)).toHaveCount(2);
  await expect(card(page, 'Local only')).toHaveCount(0);
});

test('invalid backup file changes nothing', async ({ page }, testInfo) => {
  await createBoard(page, 'Keep me', 'Blank');
  await page.goto('/');
  const bogus = testInfo.outputPath('bogus.zip');
  writeFileSync(bogus, 'not a zip');
  await importBackup(page, bogus);
  await page.getByRole('dialog', { name: 'Import backup' }).getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.getByRole('alert')).toContainText('not a Visual Boards backup');
  await expect(card(page, 'Keep me')).toBeVisible();
});

test('backup reminder after 30 days with changes, snoozable', async ({ page }) => {
  await importBackup(page, 'tests/fixtures/backup-v1.zip');
  await expect(cards(page)).toHaveCount(2);
  await setMeta(page, 'lastBackupAt', '2020-01-01T00:00:00.000Z');
  await page.reload();
  const note = page.getByRole('note');
  await expect(note).toContainText('Last backup');
  await note.getByRole('button', { name: 'Later' }).click();
  await expect(note).toHaveCount(0);
  await page.reload();
  await expect(cards(page)).toHaveCount(2);
  await expect(page.getByRole('note')).toHaveCount(0);
});

test('fixture is a real zip', () => {
  expect(readFileSync('tests/fixtures/backup-v1.zip').subarray(0, 2).toString()).toBe('PK');
});
