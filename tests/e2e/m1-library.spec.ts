import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = (name: string) => `tests/fixtures/${name}`;
const tiles = (page: Page) => page.locator('[data-asset-id]');

interface StoredAsset {
  fileName: string;
  width: number;
  height: number;
  favorite: boolean;
}

function readAssets(page: Page): Promise<StoredAsset[]> {
  return page.evaluate(
    () =>
      new Promise<StoredAsset[]>((resolve, reject) => {
        const open = indexedDB.open('visual-boards');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const req = open.result.transaction('assets').objectStore('assets').getAll();
          req.onsuccess = () => {
            resolve(req.result as StoredAsset[]);
            open.result.close();
          };
        };
      }),
  );
}

async function upload(page: Page, names: string[]) {
  await page.getByTestId('upload-input').setInputFiles(names.map(fixture));
}

/** Builds a File inside the page from fixture bytes, for synthetic paste/drop events. */
async function dispatchWithFile(page: Page, kind: 'paste' | 'drop', name: string, type: string) {
  const bytes = [...readFileSync(fixture(name))];
  await page.evaluate(
    ({ kind, bytes, name, type }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
      if (kind === 'paste') {
        document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
      } else {
        for (const t of ['dragenter', 'dragover', 'drop']) {
          document.body.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true }));
        }
      }
    },
    { kind, bytes, name, type },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { name: 'Library', level: 1 })).toBeVisible();
});

test('uploads images with correct orientation, HEIC and duplicate detection; survives reload', async ({ page }) => {
  await upload(page, ['landscape.jpg', 'portrait.png', 'rotated-exif6.jpg', 'sample.heic']);
  await expect(tiles(page)).toHaveCount(4, { timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: '4 images added' })).toBeVisible();

  const assets = await readAssets(page);
  const rotated = assets.find((a) => a.fileName === 'rotated-exif6.jpg')!;
  expect([rotated.width, rotated.height]).toEqual([300, 600]); // EXIF 6 applied: portrait, not sideways
  const heic = assets.find((a) => a.fileName === 'sample.heic')!;
  expect(heic.width).toBeGreaterThan(0);

  // Same bytes under another name: skipped with a notice.
  await upload(page, ['landscape-copy.jpg']);
  await expect(page.getByRole('status').filter({ hasText: '1 already in the library' })).toBeVisible();
  await expect(tiles(page)).toHaveCount(4);

  await page.reload();
  await expect(tiles(page)).toHaveCount(4);
  await expect(page.locator('[data-asset-id] img')).toHaveCount(4);
});

test('paste and drop add images', async ({ page }) => {
  await dispatchWithFile(page, 'paste', 'landscape.jpg', 'image/jpeg');
  await expect(tiles(page)).toHaveCount(1);
  await dispatchWithFile(page, 'drop', 'portrait.png', 'image/png');
  await expect(tiles(page)).toHaveCount(2);
});

test('multi-select, favorite, filter and delete with confirmation', async ({ page, isMobile }) => {
  test.skip(isMobile, 'mouse modifiers are desktop-only; touch selection has its own test');
  await upload(page, ['landscape.jpg', 'portrait.png', 'rotated-exif6.jpg']);
  await expect(tiles(page)).toHaveCount(3, { timeout: 30_000 });

  const tile = (i: number) => tiles(page).nth(i);
  await tile(0).click();
  await tile(2).click({ modifiers: ['Shift'] });
  await expect(page.getByTestId('selection-count')).toHaveText('3 selected');
  await tile(1).click({ modifiers: ['ControlOrMeta'] });
  await expect(page.getByTestId('selection-count')).toHaveText('2 selected');

  await page.getByRole('toolbar').getByRole('button', { name: 'Favorite' }).click();
  await page.getByRole('radio', { name: 'Favorites' }).click();
  await expect(tiles(page)).toHaveCount(2);
  await page.getByRole('radio', { name: 'All' }).click();

  await page.getByRole('button', { name: 'Select all' }).click();
  await expect(page.getByTestId('selection-count')).toHaveText('3 selected');
  await page.getByRole('button', { name: 'Clear selection' }).click();

  await tile(0).click();
  await page.getByRole('toolbar').getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Delete 1 image?');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(tiles(page)).toHaveCount(3);

  await page.getByRole('toolbar').getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(tiles(page)).toHaveCount(2);
  expect(await readAssets(page)).toHaveLength(2);
});

test('long press enters selection mode on touch', async ({ page, browserName }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch || browserName !== 'chromium', 'touch + CDP only');
  await upload(page, ['landscape.jpg', 'portrait.png']);
  await expect(tiles(page)).toHaveCount(2, { timeout: 30_000 });

  const box = (await tiles(page).nth(0).boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(700);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.getByTestId('selection-count')).toHaveText('1 selected');

  await tiles(page).nth(1).tap();
  await expect(page.getByTestId('selection-count')).toHaveText('2 selected');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('selection-count')).toHaveCount(0);
});

test('bulk quote import with preview, edits and duplicate skipping', async ({ page }) => {
  await page.getByRole('tab', { name: /Quotes/ }).click();
  await page.getByRole('button', { name: 'Import quotes' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Import quotes' }).fill(
    [
      '"The journey is the thing." — Homer',
      '',
      '„Ko rano rani, dve sreće grabi.“ | Narodna izreka',
      '',
      'Stay close to anything that makes you glad you are alive.',
      '- Hafiz',
      '',
      'Not all those who wander are lost.',
    ].join('\n'),
  );
  await expect(dialog.getByTestId('import-summary')).toHaveText('Recognized: 4 quotes, 3 with author');

  const rows = dialog.getByTestId('import-row');
  await rows.nth(3).getByRole('textbox', { name: 'Author' }).fill('J. R. R. Tolkien');
  await rows.nth(1).getByRole('checkbox').uncheck();
  await dialog.getByRole('button', { name: 'Import 3 quotes' }).click();

  const cards = page.getByTestId('quote-card');
  await expect(cards).toHaveCount(3);
  await expect(cards.filter({ hasText: 'Not all those who wander' })).toContainText('— J. R. R. Tolkien');
  await expect(cards.filter({ hasText: 'The journey is the thing.' })).toContainText('— Homer');

  // Importing the same text again: duplicates are flagged and skipped by default.
  await page.getByRole('button', { name: 'Import quotes' }).click();
  await dialog.getByRole('textbox', { name: 'Import quotes' }).fill('The journey is the thing. — Homer\n\nA brand new one');
  await expect(dialog.getByText('Already in library')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Import 1 quote' }).click();
  await expect(cards).toHaveCount(4);

  await page.getByRole('searchbox').fill('homer');
  await expect(cards).toHaveCount(1);

  await page.reload();
  await page.getByRole('tab', { name: /Quotes/ }).click();
  await expect(page.getByTestId('quote-card')).toHaveCount(4);
});
