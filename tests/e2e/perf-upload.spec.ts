import { expect, test } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// M1 performance criterion: 100 JPEGs of ~5MB, UI stays responsive, thumbnails
// appear progressively, total under ~60s. Needs a folder of large photos:
//   PERF_DIR=/path/to/photos npx playwright test perf-upload --project=desktop
const dir = process.env.PERF_DIR;

test('uploads 100 large photos responsively', async ({ page }) => {
  test.skip(!dir, 'set PERF_DIR to a folder with ~100 large JPEGs');
  test.setTimeout(180_000);
  const files = readdirSync(dir!)
    .filter((f) => /\.jpe?g$/i.test(f))
    .map((f) => join(dir!, f));

  await page.goto('/#/library');
  // Longest gap between animation frames = the worst UI freeze during upload.
  await page.evaluate(() => {
    const w = window as unknown as { maxGap: number; stopFrames: boolean };
    w.maxGap = 0;
    let last = performance.now();
    const tick = (now: number) => {
      w.maxGap = Math.max(w.maxGap, now - last);
      last = now;
      if (!w.stopFrames) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const started = Date.now();
  await page.getByTestId('upload-input').setInputFiles(files);
  // Progressive: the first thumbnails show up long before the batch is done.
  await expect(page.locator('[data-asset-id]').first()).toBeVisible({ timeout: 20_000 });
  const firstAfter = Date.now() - started;
  await expect(page.getByTestId('upload-count')).toBeHidden({ timeout: 150_000 });
  const total = Date.now() - started;

  const maxGap = await page.evaluate(() => {
    const w = window as unknown as { maxGap: number; stopFrames: boolean };
    w.stopFrames = true;
    return w.maxGap;
  });
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const open = indexedDB.open('visual-boards');
        open.onsuccess = () => {
          const req = open.result.transaction('assets').objectStore('assets').count();
          req.onsuccess = () => resolve(req.result);
        };
      }),
  );
  console.log(`files=${files.length} stored=${count} first=${firstAfter}ms total=${total}ms maxFrameGap=${Math.round(maxGap)}ms`);
  expect(count).toBe(files.length);
  expect(total).toBeLessThan(60_000);
  expect(maxGap).toBeLessThan(250);
});
