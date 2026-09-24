import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dumpDb } from './helpers';

const FIXTURES = ['landscape.jpg', 'portrait.png', 'rotated-exif6.jpg'].map((f) => `tests/fixtures/${f}`);
const cards = (page: Page) => page.locator('[data-item-id]');
const thumbs = (page: Page) => page.locator('[data-asset-id]');

async function newBoard(page: Page, preset = 'Inspiration Wall') {
  await page.goto('/');
  await page.getByRole('button', { name: 'New board' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New board' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Wall');
  await dialog.getByRole('radio', { name: new RegExp(preset) }).click();
  await dialog.getByRole('button', { name: 'Create board' }).click();
  await expect(page.getByTestId('wall')).toBeVisible();
}

async function openLibrary(page: Page) {
  const button = page.getByRole('button', { name: 'Library', exact: true });
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}

async function uploadToLibrary(page: Page, files = FIXTURES) {
  await openLibrary(page);
  await page.getByTestId('upload-input').setInputFiles(files);
  await expect(thumbs(page)).toHaveCount(files.length, { timeout: 30_000 });
}

type StoredBoard = {
  items: { id: string; sectionId?: string; front: { assetId?: string } }[];
  sections: { id: string; title: string }[];
};

/** The saved board, once autosave has caught up with what the wall shows. */
async function boardItems(page: Page): Promise<StoredBoard> {
  let board: StoredBoard | undefined;
  await expect
    .poll(async () => {
      const shown = await cards(page).count();
      board = (await dumpDb(page)).boards[0] as unknown as StoredBoard;
      return board.items.length >= shown && shown > 0 ? 'saved' : `${board.items.length}/${shown}`;
    })
    .toBe('saved');
  return board!;
}

/** Mouse drag with small steps so dnd-kit activates and tracks the pointer. */
async function mouseDrag(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + box.height / 2 + 4, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

async function mouseDragFrom(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 12, from.y + 4, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

async function point(locator: Locator, fx: number, fy: number) {
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}

test.describe('desktop mouse', () => {
  test.skip(({ isMobile, hasTouch }) => isMobile || hasTouch, 'mouse drag scenarios');

  test('drags one and then several images from the library to the exact drop position', async ({ page }) => {
    await newBoard(page);
    await uploadToLibrary(page);

    // First card: dropped anywhere on the empty wall.
    await mouseDrag(page, thumbs(page).nth(0), await point(page.getByTestId('wall'), 0.5, 0.3));
    await expect(cards(page)).toHaveCount(1);

    // Before the first card: upper half of it.
    const first = (await boardItems(page)).items[0]!;
    await mouseDrag(page, thumbs(page).nth(1), await point(cards(page).first(), 0.5, 0.15));
    await expect(cards(page)).toHaveCount(2);
    const two = (await boardItems(page)).items;
    expect(two[1]!.id).toBe(first.id);

    // Multi-select two thumbnails and drag them after the first card (lower half).
    await thumbs(page).nth(0).click();
    await thumbs(page).nth(2).click({ modifiers: ['ControlOrMeta'] });
    const selectedAssets = [
      await thumbs(page).nth(0).getAttribute('data-asset-id'),
      await thumbs(page).nth(2).getAttribute('data-asset-id'),
    ];
    await mouseDrag(page, thumbs(page).nth(2), await point(page.locator(`[data-item-id="${two[0]!.id}"]`), 0.5, 0.9));
    await expect(cards(page)).toHaveCount(4);
    const four = (await boardItems(page)).items;
    expect(four[0]!.id).toBe(two[0]!.id);
    expect(four.slice(1, 3).map((i) => i.front.assetId)).toEqual(selectedAssets);
    expect(four[3]!.id).toBe(two[1]!.id);
  });

  test('reorders cards by dragging, with the others making room', async ({ page }) => {
    await newBoard(page);
    await uploadToLibrary(page);
    await page.getByRole('button', { name: 'Add all unused' }).click();
    await expect(cards(page)).toHaveCount(3);
    const before = (await boardItems(page)).items.map((i) => i.id);

    const target = page.locator(`[data-item-id="${before[2]}"]`);
    const box = (await cards(page).first().boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2 + 10, { steps: 3 });
    const to = await point(target, 0.5, 0.9);
    await page.mouse.move(to.x, to.y, { steps: 15 });
    await expect(page.locator('[data-placeholder]')).toHaveCount(1);
    await page.mouse.up();

    await expect.poll(async () => (await boardItems(page)).items.map((i) => i.id)).toEqual([before[1], before[2], before[0]]);
    // Clicking after a drag still selects normally.
    await cards(page).first().click();
    await expect(cards(page).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('columns, spacing, span, sections, month dividers, delete', async ({ page }) => {
    await newBoard(page);
    await uploadToLibrary(page);
    await page.getByRole('button', { name: 'Add all unused' }).click();
    await expect(cards(page)).toHaveCount(3);
    await expect(page.getByRole('radio', { name: 'Not on board' })).toBeVisible();
    await page.getByRole('radio', { name: 'Not on board' }).click();
    await expect(thumbs(page)).toHaveCount(0);
    await page.getByRole('radio', { name: 'All' }).click();

    // Manual columns: 3 columns → every card a third of the inner width.
    await page.getByRole('checkbox', { name: 'Auto' }).uncheck();
    await page.getByRole('slider', { name: 'Columns' }).fill('3');
    const wallBox = (await page.getByTestId('wall').boundingBox())!;
    const w1 = (await cards(page).first().boundingBox())!.width;
    expect(w1).toBeGreaterThan(wallBox.width / 3 - 40);
    expect(w1).toBeLessThan(wallBox.width / 3);

    // Span 2 on the first card.
    await cards(page).first().click();
    await page.getByRole('radio', { name: '2 columns' }).click();
    await expect.poll(async () => (await cards(page).first().boundingBox())!.width).toBeGreaterThan(w1 * 2);

    // Spacing.
    await page.keyboard.press('Escape');
    await page.getByRole('slider', { name: 'Spacing' }).fill('40');
    await expect.poll(async () => (await dumpDb(page)).boards[0]).toMatchObject({ theme: { gap: 40 } });

    // Sections: add one and drag a card into it.
    await page.getByTestId('wall').click({ position: { x: 5, y: 5 } });
    await page.getByRole('button', { name: 'Add section' }).click();
    const header = page.getByTestId('wall').getByRole('textbox', { name: 'Section title' });
    await header.fill('Travel');
    await page.getByText('Drop cards here').scrollIntoViewIfNeeded();
    await expect(page.getByText('Drop cards here')).toBeInViewport();
    const lastCard = page.locator(`[data-item-id="${(await boardItems(page)).items[2]!.id}"]`);
    await expect(lastCard).toBeInViewport({ ratio: 0.2 });
    {
      // Grab the part of the card that is inside the visible wall.
      const box = (await lastCard.boundingBox())!;
      const wall = (await page.getByTestId('wall').boundingBox())!;
      const grab = { x: box.x + box.width / 2, y: Math.max(box.y, wall.y) + 20 };
      await mouseDragFrom(page, grab, await point(page.getByText('Drop cards here'), 0.5, 0.5));
    }
    await expect.poll(async () => (await boardItems(page)).items.filter((i) => i.sectionId).length).toBe(1);
    await expect(page.getByText('Drop cards here')).toHaveCount(0);

    // Month dividers replace sections with month headings.
    await page.getByRole('checkbox', { name: 'Month dividers' }).check();
    const month = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date());
    await expect(page.getByRole('heading', { name: month })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Month dividers' }).uncheck();

    // Delete key removes the selected card; the image stays in the library.
    await cards(page).first().click();
    await page.keyboard.press('Delete');
    await expect(cards(page)).toHaveCount(2);
    await expect(thumbs(page)).toHaveCount(3);

    await page.reload();
    await expect(cards(page)).toHaveCount(2);
    await expect(page.getByTestId('wall').getByRole('textbox', { name: 'Section title' })).toHaveValue('Travel');
  });

  test('files dropped on the wall land where they are dropped; pasted images go to the end', async ({ page }) => {
    await newBoard(page);
    await uploadToLibrary(page, FIXTURES.slice(0, 2));
    await page.getByRole('button', { name: 'Add all unused' }).click();
    await expect(cards(page)).toHaveCount(2);
    const before = (await boardItems(page)).items.map((i) => i.id);

    const bytes = [...readFileSync('tests/fixtures/rotated-exif6.jpg')];
    const at = await point(cards(page).first(), 0.5, 0.1);
    await page.getByTestId('wall').evaluate(
      (wall, { bytes, at }) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(bytes)], 'dropped.jpg', { type: 'image/jpeg' }));
        for (const type of ['dragenter', 'dragover', 'drop']) {
          wall.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: at.x, clientY: at.y }));
        }
      },
      { bytes, at },
    );
    await expect(cards(page)).toHaveCount(3);
    const after = (await boardItems(page)).items.map((i) => i.id);
    expect(after.slice(1)).toEqual(before);
    await expect(thumbs(page)).toHaveCount(3);

    // Paste: an image already in the library is placed again at the end.
    const pasteBytes = [...readFileSync('tests/fixtures/landscape.jpg')];
    await page.evaluate((b) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(b)], 'pasted.jpg', { type: 'image/jpeg' }));
      document.body.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    }, pasteBytes);
    await expect(cards(page)).toHaveCount(4);
  });
});

test('touch: long press reorders on the wall; tap in the library adds to the end', async ({ page, browserName }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch || browserName !== 'chromium', 'touch + CDP only');
  await newBoard(page);
  await uploadToLibrary(page);

  // Tap a thumbnail: added at the end.
  await thumbs(page).nth(0).tap();
  await thumbs(page).nth(1).tap();
  await thumbs(page).nth(2).tap();
  await expect.poll(async () => (await boardItems(page)).items.length).toBe(3);
  await page.getByRole('button', { name: 'Library', exact: true }).click(); // close the drawer
  const before = (await boardItems(page)).items.map((i) => i.id);

  const cdp = await page.context().newCDPSession(page);
  const from = await point(cards(page).first(), 0.5, 0.5);
  const to = await point(page.locator(`[data-item-id="${before[2]}"]`), 0.5, 0.92);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  await page.waitForTimeout(400); // long press
  for (let i = 1; i <= 12; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / 12, y: from.y + ((to.y - from.y) * i) / 12 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await boardItems(page)).items.map((i) => i.id)).toEqual([before[1], before[2], before[0]]);
});

test('1000 cards: only nearby cards are mounted, scrolling stays smooth, nothing shifts while images load @perf', async ({ page, isMobile }) => {
  test.skip(isMobile, 'measured on desktop and tablet');
  test.setTimeout(90_000);
  await newBoard(page);
  await uploadToLibrary(page);
  const assets = (await dumpDb(page)).assets.map((a) => a.id);
  const boardId = (await dumpDb(page)).boards[0]!.id;

  // Put 1000 cards on the board directly in IndexedDB, then reload.
  await page.evaluate(
    ({ assets, boardId }) =>
      new Promise<void>((resolve) => {
        const open = indexedDB.open('visual-boards');
        open.onsuccess = () => {
          const tx = open.result.transaction('boards', 'readwrite');
          const store = tx.objectStore('boards');
          const get = store.get(boardId);
          get.onsuccess = () => {
            const board = get.result;
            board.items = Array.from({ length: 1000 }, (_, i) => ({
              id: `c${i}`,
              front: { kind: 'image', assetId: assets[i % assets.length] },
              style: { aspect: 'original', radius: 6, shadow: 'soft' },
              addedAt: new Date().toISOString(),
            }));
            store.put(board);
          };
          tx.oncomplete = () => resolve();
        };
      }),
    { assets, boardId },
  );
  await page.reload();
  await expect(page.locator('[data-item-id="c0"]')).toBeVisible();
  const mounted = await cards(page).count();
  expect(mounted).toBeGreaterThan(5);
  expect(mounted).toBeLessThan(150);

  // Positions are known before images load: the first card does not move once loaded.
  const firstBefore = await page.locator('[data-item-id="c5"]').boundingBox();
  await expect(page.locator('[data-item-id="c5"] img')).toHaveJSProperty('complete', true);
  expect(await page.locator('[data-item-id="c5"]').boundingBox()).toEqual(firstBefore);

  // Scroll through the whole wall frame by frame and record the worst frame gap.
  const result = await page.getByTestId('wall').evaluate(
    (wall) =>
      new Promise<{ maxGap: number; frames: number; reachedEnd: boolean }>((resolve) => {
        let last = performance.now();
        let maxGap = 0;
        let frames = 0;
        const step = () => {
          const now = performance.now();
          maxGap = Math.max(maxGap, now - last);
          last = now;
          frames++;
          wall.scrollTop += 400;
          if (wall.scrollTop + wall.clientHeight >= wall.scrollHeight - 2 || frames > 3000) {
            resolve({ maxGap, frames, reachedEnd: wall.scrollTop + wall.clientHeight >= wall.scrollHeight - 2 });
          } else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
  );
  console.log(`1000 cards: frames=${result.frames} maxFrameGap=${Math.round(result.maxGap)}ms`);
  expect(result.reachedEnd).toBe(true);
  expect(result.maxGap).toBeLessThan(100);
  await expect(page.locator('[data-item-id="c999"]')).toBeVisible();
  expect(await cards(page).count()).toBeLessThan(150);
});
