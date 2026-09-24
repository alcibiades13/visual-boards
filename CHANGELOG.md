# Changelog

## M4 — Cards (2026-09-24)

- One `<Card>` renders images, quotes, text, text over images, flip cards (any two faces) and captions.
- Text over images: 9 positions on a visual grid, 7 readability effects with intensity, auto text size within 60% of the image with a "too long" warning.
- Flip cards: 3D flip (crossfade with reduced motion); button and F key in Edit mode, click/Space in the new View mode.
- Quotes on the wall: drag from the library, drop onto an image to put it over the image or on the back, random quote, tap/double-click to add; quote and text cards with text styles.
- Card inspector: content and text style, focal point picker, overlay and back, caption, aspect ratio, corners, shadow, border, width.
- Editing a quote in the library (or inspector) updates every card that uses it.
- Fixes: drops below the last card land at the end; the quote chooser works right after a drop; only cards inside the wall listbox; 3D layers only for flip cards; the focal picker matches the image shape.
- Tests: fit algorithm, overlay presentation, card operations; Playwright flows for all M4 criteria. Performance checks moved to `npm run e2e:perf`.

## M3 — Masonry wall (2026-09-24)

- Layout engine interface and the masonry engine: shortest-column packing, span 1–3, auto/manual columns, sections as full-width blocks, month dividers. Pure and unit-tested, including "no gaps larger than the spacing" and hit testing.
- Board editor: library sidebar (resizable, hideable) with drag onto the wall, wall in the middle, inspector on the right; drawers on tablet and phone.
- Drag & drop with dnd-kit: one or many images from the library to the exact drop position; reorder cards with animated reflow; mouse and long-press touch.
- Virtualized wall: only cards near the viewport are mounted; card sizes are known up front so nothing shifts while images load (1000 cards tested).
- Library on a board: "on this board" marks, "Not on board" filter, "Add all unused", "Add to board", tap/double-click to add.
- Files dropped on the wall land at the drop position; pasted images go to the board as well.
- Board operations (insert, move, remove, span, sections) as pure, tested functions.
- Fix: changes are written synchronously when the page is hidden or reloaded.

## M2 — Boards and backup (2026-09-24)

- Dashboard: board cards with cover (chosen cover or first images), image/quote counts and relative edit time; rename, duplicate and delete from a card menu.
- New board dialog: name plus Inspiration Wall, Vision Board (optional sections), Moodboard or Blank.
- Board page with an inline editable title and autosave (500 ms debounce, flushed on tab hide/close).
- Backup: "Export everything" to a .zip (data.json + images), import with Merge or Replace, atomic replace, duplicate-free merge, reminder after 30 days with snooze.
- Tests: autosave ordering, backup round-trip, merge remapping, reminder rules, loading a committed v1 backup; Playwright flows for board management, save-on-close, export → import into a fresh profile with identical data, invalid files and the reminder.

## M1 — Library and upload (2026-09-24)

- Image pipeline in a pool of Web Workers: EXIF orientation, resize to 2400px, 640px thumbnail, WebP with JPEG fallback; HEIC via native decode or lazy heic2any.
- Duplicate detection by SHA-256 with a notice; progress "37/120" with cancel; thumbnails appear one by one.
- Intake from the Upload button, drag of files or whole folders anywhere in the window, paste, and images dragged from another tab.
- Library page (`#/library`): virtualized masonry of thumbnails, size slider, multi-select (click, Shift, Cmd/Ctrl, long press on touch), select all, favorites, filter, sort, delete with a usage warning.
- Quotes: bulk import with a live editable preview, author recognition, duplicate skipping; search and favorites.
- en/sr plural forms; toasts and confirmation dialogs.
- Tests: quote parser, column packing, selection, sniffing, plurals; Playwright flows for upload/HEIC/EXIF/duplicates/reload, paste and drop, selection, long press and quote import; optional 100-photo performance test (`PERF_DIR`).

## M0 — Foundation (2026-09-24)

- Vite 8 + React 18 + TypeScript strict, Tailwind v4, Zustand, Immer, Dexie, dnd-kit, Vitest, Playwright, ESLint.
- Data model from blueprint §4 in `src/model/` with factories, schema migration entry point and computed usage index.
- Repository layer (`BoardRepo`, `AssetRepo`, `QuoteRepo`, `BlobRepo`, `MetaRepo`) with a Dexie implementation and tests on fake-indexeddb.
- Light/dark theme through CSS variables, self-hosted Newsreader + Inter.
- `navigator.storage.persist()` requested on first run.
- App shell: hash router, empty dashboard, board route placeholder, English/Serbian UI.
- Playwright smoke test at 1440, 1024 and 390px.
