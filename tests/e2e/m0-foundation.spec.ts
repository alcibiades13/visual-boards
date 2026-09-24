import { expect, test } from '@playwright/test';

test('app shell loads without errors, with local fonts and IndexedDB', async ({ page }, testInfo) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) external.push(r.url());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // Self-hosted fonts are ready, no CDN requests (blueprint §3, §10).
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      serif: document.fonts.check('16px "Newsreader Variable"'),
      sans: document.fonts.check('16px "Inter Variable"'),
    };
  });
  expect(fonts).toEqual({ serif: true, sans: true });
  expect(external).toEqual([]);

  // The Dexie database is created on boot.
  await expect
    .poll(() => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name)))
    .toContain('visual-boards');

  // Language switch persists across reloads.
  await page.getByRole('button', { name: 'sr', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Moji boardovi');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Moji boardovi');

  // No horizontal scroll at any viewport.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);

  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('unknown board shows a calm not-found message', async ({ page }) => {
  await page.goto('/#/b/does-not-exist');
  await expect(page.getByText(/does not exist|više ne postoji/)).toBeVisible();
});
