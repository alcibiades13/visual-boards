import { expect, test, type Page } from '@playwright/test';
import { dumpDb } from './helpers';

type Stored = { sections: { title: string }[]; theme: { background: Record<string, unknown> } };
const saved = async (page: Page) => (await dumpDb(page)).boards[0] as unknown as Stored;

async function openSettings(page: Page) {
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  if (await settings.isVisible()) await settings.click(); // tablet and phone: a sheet
}

test('a Vision Board has no sections unless chosen', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New board' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New board' });
  await dialog.getByRole('radio', { name: /Vision Board/ }).click();
  await expect(dialog.getByRole('button', { name: 'Health' })).toHaveAttribute('aria-pressed', 'false');
  await dialog.getByRole('button', { name: 'Travel' }).click();
  await dialog.getByRole('button', { name: 'Health' }).click();
  await dialog.getByRole('button', { name: 'Create board' }).click();
  await expect(page.getByTestId('wall')).toBeVisible();
  await expect.poll(async () => (await saved(page)).sections.map((s) => s.title)).toEqual(['Health', 'Travel']);
});

test('board background: theme, color (with readable titles) and a library image with a veil', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New board' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New board' });
  await dialog.getByRole('radio', { name: /Vision Board/ }).click();
  await dialog.getByRole('button', { name: 'Travel' }).click();
  await dialog.getByRole('button', { name: 'Create board' }).click();
  await expect(page.getByTestId('wall')).toBeVisible();
  await page.getByTestId('board-upload-input').setInputFiles(['tests/fixtures/landscape.jpg']);
  await expect(page.locator('[data-item-id]')).toHaveCount(1, { timeout: 30_000 });

  await openSettings(page);
  const background = page.getByRole('radiogroup', { name: 'Background' });
  const layer = page.getByTestId('wall-background');

  // A dark color: the wall turns dark and section titles turn light.
  await background.getByRole('radio', { name: 'Color' }).click();
  await page.getByRole('radio', { name: 'Background #1e2530' }).click();
  await expect(layer).toHaveCSS('background-color', 'rgb(30, 37, 48)');
  await expect(page.getByTestId('wall').getByRole('textbox', { name: 'Section title' })).toHaveCSS('color', 'rgb(241, 237, 230)');
  await expect.poll(async () => (await saved(page)).theme.background).toEqual({ kind: 'color', value: '#1e2530' });

  // A library image, softened.
  await background.getByRole('radio', { name: 'Image' }).click();
  await expect(layer.locator('img')).toHaveJSProperty('complete', true);
  await page.getByRole('slider', { name: 'Soften' }).fill('50');
  await expect.poll(async () => (await saved(page)).theme.background).toMatchObject({ kind: 'image', dim: 0.5 });

  await page.reload();
  await expect(page.getByTestId('wall-background').locator('img')).toBeVisible();

  // Back to the theme default.
  await openSettings(page);
  await page.getByRole('radiogroup', { name: 'Background' }).getByRole('radio', { name: 'Theme' }).click();
  await expect.poll(async () => (await saved(page)).theme.background).toEqual({ kind: 'color', value: 'var(--vb-board)' });
});
