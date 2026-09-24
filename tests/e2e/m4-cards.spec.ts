import { expect, test, type Locator, type Page } from '@playwright/test';
import { dumpDb } from './helpers';

const IMAGES = ['landscape.jpg', 'portrait.png', 'rotated-exif6.jpg'].map((f) => `tests/fixtures/${f}`);
const cards = (page: Page) => page.locator('[data-item-id]');
const LONG = 'Stay close to anything that makes you glad you are alive, and keep walking slowly through the small hours of the morning while the city is still asleep and the light is only beginning to find the rooftops. '.repeat(3);

type StoredItem = { id: string; caption?: string; style: Record<string, unknown>; front: Record<string, unknown>; back?: Record<string, unknown> };

const read = async (page: Page) => ((await dumpDb(page)).boards[0] as unknown as { items: StoredItem[] }).items;

/** The saved items once autosave has caught up: same cards as on screen, and unchanged for a moment. */
async function savedItems(page: Page): Promise<StoredItem[]> {
  let items: StoredItem[] = [];
  let previous = '';
  await expect
    .poll(
      async () => {
        items = await read(page);
        const shown = await cards(page).count();
        const snapshot = JSON.stringify(items);
        const stable = snapshot === previous;
        previous = snapshot;
        return items.length === shown && stable;
      },
      { intervals: [700], timeout: 10_000 },
    )
    .toBe(true);
  return items;
}

async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New board' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'New board' });
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Cards');
  await dialog.getByRole('button', { name: 'Create board' }).click();
  await expect(page.getByTestId('wall')).toBeVisible();
  const library = page.getByRole('button', { name: 'Library', exact: true });
  if ((await library.getAttribute('aria-pressed')) !== 'true') await library.click();
  await page.getByTestId('upload-input').setInputFiles(IMAGES);
  await expect(page.locator('[data-asset-id]')).toHaveCount(3, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Add all unused' }).click();
  await expect(cards(page)).toHaveCount(3);

  await page.getByRole('tab', { name: /Quotes/ }).click();
  await page.getByRole('button', { name: 'Import quotes' }).click();
  await page
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Import quotes' })
    .fill('The journey is the thing. — Homer\n\nNot all those who wander are lost. — Tolkien');
  await page.getByRole('dialog').getByRole('button', { name: 'Import 2 quotes' }).click();
  await expect(page.getByTestId('quote-card')).toHaveCount(2);
}


/** Drags onto a card, re-aiming once the other cards have made room (as a person would). */
async function dragOnto(page: Page, from: Locator, target: Locator) {
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 12, box.y + 16, { steps: 3 });
  let to = await center(target);
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.waitForTimeout(350);
  to = await center(target);
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.waitForTimeout(350);
  to = await center(target);
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function center(locator: Locator) {
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const quote = (page: Page, text: string) => page.getByTestId('quote-card').filter({ hasText: text });

test.describe('cards (desktop)', () => {
  test.skip(({ isMobile, hasTouch }) => isMobile || hasTouch, 'mouse drag scenarios');

  test('quote and text cards; a quote dropped on an image goes over it or on its back', async ({ page }) => {
    await setup(page);
    const [img1, img2] = (await savedItems(page)).map((i) => i.id);

    // Quote dropped between cards (here: below them) → a new quote card, not an overlay.
    await dragOnto(page, quote(page, 'journey'), page.getByRole('button', { name: /Add images/ }));
    await expect(cards(page)).toHaveCount(4);
    await expect(page.getByTestId('wall').getByText('The journey is the thing.')).toBeVisible();

    // Onto the middle of an image → choose "Over the image".
    await dragOnto(page, quote(page, 'wander'), page.locator(`[data-item-id="${img1}"]`));
    await page.getByRole('dialog', { name: 'Place the quote' }).getByRole('button', { name: 'Over the image' }).click();
    await expect(page.locator(`[data-item-id="${img1}"]`)).toContainText('Not all those who wander are lost.');
    await expect(cards(page)).toHaveCount(4);

    // Onto another image → "On the back": a flip card.
    await dragOnto(page, quote(page, 'journey'), page.locator(`[data-item-id="${img2}"]`));
    await page.getByRole('dialog', { name: 'Place the quote' }).getByRole('button', { name: 'On the back', exact: true }).click();
    const flipCard = page.locator(`[data-item-id="${img2}"]`);
    await expect(flipCard.getByRole('button', { name: 'Flip card' })).toBeVisible();

    // Text card from the header, edited in the inspector.
    await page.getByRole('button', { name: 'Add a text card' }).click();
    await expect(cards(page)).toHaveCount(5);
    await page.getByRole('complementary', { name: 'Settings' }).getByRole('textbox', { name: 'Text', exact: true }).fill('Autumn goals');
    await expect(page.getByTestId('wall').getByText('Autumn goals')).toBeVisible();

    const items = await savedItems(page);
    expect(items.find((i) => i.id === img1)!.front).toMatchObject({ overlay: { position: 'bc', effect: 'dark-gradient' } });
    expect(items.find((i) => i.id === img2)!.back).toMatchObject({ kind: 'quote' });
    expect(items.some((i) => i.front.kind === 'quote')).toBe(true);
    expect(items.some((i) => i.front.kind === 'text' && i.front.text === 'Autumn goals')).toBe(true);

    // Removing overlay and back returns plain images; quotes stay in the library.
    await page.locator(`[data-item-id="${img1}"]`).click();
    await page.getByRole('button', { name: 'Remove text' }).click();
    await flipCard.click({ position: { x: 20, y: 20 } });
    await page.getByRole('button', { name: 'Remove back' }).click();
    const cleared = await savedItems(page);
    expect(cleared.find((i) => i.id === img1)!.front.overlay).toBeUndefined();
    expect(cleared.find((i) => i.id === img2)!.back).toBeUndefined();
    await expect(page.getByTestId('quote-card')).toHaveCount(2);
  });

  test('overlay: 9 positions, 7 effects, intensity, auto size with a warning for long text', async ({ page }) => {
    await setup(page);
    const [img] = (await savedItems(page)).map((i) => i.id);
    const card = page.locator(`[data-item-id="${img}"]`);
    await card.click();
    await page.getByRole('button', { name: 'Own text' }).click();
    await expect(card).toContainText('New note');

    const positions = page.getByRole('radiogroup', { name: 'Position' }).getByRole('radio');
    await expect(positions).toHaveCount(9);
    await page.getByRole('radio', { name: 'Top left' }).click();
    const effect = page.getByRole('combobox', { name: 'Readability' });
    await expect(effect.locator('option')).toHaveCount(7);
    await effect.selectOption('panel');
    await page.getByRole('slider', { name: 'Intensity' }).fill('100');
    let saved = (await savedItems(page)).find((i) => i.id === img)!;
    expect(saved.front.overlay).toMatchObject({ position: 'tl', effect: 'panel', intensity: 1 });

    // Short text fits at a large auto size.
    const size = () => card.locator('p').first().evaluate((p) => parseFloat(getComputedStyle(p).fontSize));
    const short = await size();
    expect(short).toBeGreaterThan(20);

    // Long text shrinks; beyond the minimum the inspector warns.
    const text = page.getByRole('complementary', { name: 'Settings' }).getByRole('textbox', { name: 'Text', exact: true });
    await text.fill(LONG.slice(0, 190));
    expect(await size()).toBeLessThan(short);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await text.fill(LONG.repeat(4));
    await expect(page.getByRole('alert')).toContainText('too long');
    expect(await size()).toBe(12);

    for (const e of ['shadow', 'dark-gradient', 'light-gradient', 'blur', 'outline', 'none']) await effect.selectOption(e);
    saved = (await savedItems(page)).find((i) => i.id === img)!;
    expect(saved.front.overlay).toMatchObject({ effect: 'none' });
  });

  test('flip: button in Edit mode, click and keyboard in View mode, crossfade with reduced motion', async ({ page }) => {
    await setup(page);
    const [img] = (await savedItems(page)).map((i) => i.id);
    const card = page.locator(`[data-item-id="${img}"]`);
    await card.click();
    await page.getByRole('button', { name: 'Text on the back' }).click();
    await page.getByRole('complementary', { name: 'Settings' }).getByRole('textbox', { name: 'Text', exact: true }).fill('Kyoto, 2019');

    // Edit mode: clicking the card selects it; only the button flips.
    await card.click({ position: { x: 30, y: 60 } });
    await expect(card).not.toHaveAttribute('data-flipped');
    await card.getByRole('button', { name: 'Flip card' }).click();
    await expect(card).toHaveAttribute('data-flipped', 'true');
    await card.getByRole('button', { name: 'Flip card' }).click();
    await expect(card).not.toHaveAttribute('data-flipped');

    // View mode: no library or inspector; a click flips, Space flips back.
    await page.getByRole('radio', { name: 'View' }).click();
    await expect(page.getByRole('tab', { name: /Images/ })).toHaveCount(0);
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await card.click();
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('.vb-flipper')).toHaveCSS('transform', /matrix3d/);
    await card.focus();
    await page.keyboard.press('Space');
    await expect(card).toHaveAttribute('aria-pressed', 'false');

    // Reduced motion: no rotation, the back fades in instead.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card.click();
    await expect(card.locator('.vb-flipper')).toHaveCSS('transform', 'none');
    await expect(card.locator('.vb-face-back')).toHaveCSS('opacity', '1');
    await expect(card.locator('.vb-face-front')).toHaveCSS('opacity', '0');
  });

  test('aspect ratio, focal point, radius, shadow, border and caption', async ({ page }) => {
    await setup(page);
    const [img] = (await savedItems(page)).map((i) => i.id);
    const card = page.locator(`[data-item-id="${img}"]`);
    await card.click();

    await page.getByRole('radio', { name: '1:1' }).click();
    await expect.poll(async () => {
      const b = (await card.boundingBox())!;
      return Math.abs(b.width - b.height) < 1;
    }).toBe(true);

    const picker = page.getByRole('button', { name: /Focus point/ });
    await picker.scrollIntoViewIfNeeded();
    const box = (await picker.locator('..').boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.3);
    await expect(card.locator('img').first()).toHaveCSS('object-position', '20% 30%');

    await page.getByRole('slider', { name: 'Corners' }).fill('20');
    await page.getByRole('radio', { name: 'Lifted' }).click();
    await page.getByRole('checkbox', { name: 'Border' }).check();
    await page.getByRole('textbox', { name: 'Caption' }).fill('Kyoto');
    await expect(card).toContainText('Kyoto');
    // Square image + a caption line (after the 200ms size transition).
    await expect.poll(async () => {
      const b = (await card.boundingBox())!;
      return b.height - b.width;
    }).toBeGreaterThan(10);

    const saved = (await savedItems(page)).find((i) => i.id === img)!;
    expect(saved).toMatchObject({
      caption: 'Kyoto',
      style: { aspect: '1:1', radius: 20, shadow: 'lifted', border: { width: 2 } },
      front: { focal: { x: 0.2, y: 0.3 } },
    });
  });

  test('editing a quote in the library updates every card that uses it', async ({ page }) => {
    await setup(page);
    const [img] = (await savedItems(page)).map((i) => i.id);
    // Same quote as a quote card and over an image.
    await dragOnto(page, quote(page, 'wander'), page.getByRole('button', { name: /Add images/ }));
    await expect(cards(page)).toHaveCount(4);
    await dragOnto(page, quote(page, 'wander'), page.locator(`[data-item-id="${img}"]`));
    await page.getByRole('button', { name: 'Over the image' }).click();

    await quote(page, 'wander').getByRole('button', { name: 'Edit quote' }).click();
    const form = page.getByTestId('quote-edit');
    await form.getByRole('textbox', { name: 'Quote' }).fill('Not all who wander are lost.');
    await form.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByTestId('wall').getByText('Not all who wander are lost.')).toHaveCount(2);
    await expect(page.getByTestId('wall').getByText('Not all those who wander are lost.')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('wall').getByText('Not all who wander are lost.')).toHaveCount(2);
  });
});

test('touch: tap a quote to add it; the random quote button adds an unused one', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, 'touch only');
  await setup(page);
  await quote(page, 'journey').tap();
  await expect(cards(page)).toHaveCount(4);
  await page.getByRole('button', { name: 'Random quote' }).click();
  await expect(cards(page)).toHaveCount(5);
  // Both quotes are now on the board: one of each.
  const items = await savedItems(page);
  expect(new Set(items.filter((i) => i.front.kind === 'quote').map((i) => i.front.quoteId)).size).toBe(2);
});
