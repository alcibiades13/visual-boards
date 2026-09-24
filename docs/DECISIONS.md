# Decisions

Short notes on choices the blueprint does not cover. Newest last.

## M0

- **Routing**: a ~30-line hash router (`#/`, `#/b/:id`) instead of a router library. Works on any static host and offline as a PWA; no extra dependency.
- **Typed layout states**: `Board.layouts` is `{ [K in LayoutId]?: LayoutState<LayoutParamsMap[K]> }` instead of `Partial<Record<LayoutId, LayoutState>>`, so each layout's params are typed by its id. Same runtime shape as the blueprint.
- **Layout params**: masonry has `columns`, `minColumnWidth`, `padding`, `monthDividers`; freeform has `size` + logical `width`/`height`. The gap stays in `BoardTheme.gap` (shared by all layouts). Phase 2 params are minimal placeholders.
- **Theme-following defaults**: a new board's background is `var(--vb-board)` and default text color `var(--vb-ink)`, so untouched boards follow light/dark mode. An explicit color picked by the user is stored as a literal value.
- **Fonts**: Newsreader (serif, titles and quotes) and Inter (sans, UI), variable versions via `@fontsource-variable`. `FontId` is a union that grows as quote fonts are added.
- **Meta table**: an extra Dexie table `meta` (key/value) for app-level state such as the storage-persist result, UI language and, later, the last backup date. Accessed through `MetaRepo`.
- **Duplicate hashes** are enforced by a unique index (`&hash`) on `assets`, in addition to the check in the upload pipeline.
- **UI language** defaults to Serbian when the browser language is sr/hr/bs/me, otherwise English; the choice is saved in `meta`.
- **Architecture guards in ESLint**: `dexie` can only be imported from `src/data/**`; `src/layout/**` and `src/import/**` cannot import React, stores, UI or data.
- **TypeScript 6** (current at scaffold time) with `noUncheckedIndexedAccess` in addition to `strict`.

## M1

- **Library page `#/library`**: boards arrive in M2 and the editor in M3, so the library panel is shown on its own page for now. The same `LibraryPanel` component fills its container and will sit beside the board from M3.
- **Thumbnail size 640px** (long side) instead of ~480px: walls on retina screens need ~2× the column width; 480px looked soft. Full images stay at 2400px.
- **Hash on original bytes, computed on the main thread** (`crypto.subtle`, async/native) *before* decoding, so duplicates are skipped without the expensive decode. A unique index on `assets.hash` is the final guard.
- **HEIC**: first try the browser's own decoder (Safari handles HEIC natively); only on a decode failure lazy-load `heic2any` (1.3 MB chunk). heic2any needs `document` for its canvas, so it runs on the main thread; its libheif decoding already runs in its own worker.
- **Worker pool size**: `min(4, hardwareConcurrency − 1)`, workers terminate after 15 s idle. Browsers without `OffscreenCanvas` in workers fall back to main-thread processing.
- **Uploads in progress share one session**: a drop during a running upload joins it (one counter, one cancel). Cancel stops files not yet processed; images already stored stay.
- **Library masonry** uses `layout/columns.ts` (shortest-column packing), the core the M3 masonry engine will build on. The size slider maps to a minimum column width (80/110/160px), giving 2–4 columns in a ~340px side panel and more on the full page.
- **Selection**: plain click replaces, Shift selects the range from the anchor (anchor stays), Cmd/Ctrl toggles. Touch: long press (450 ms) enters selection mode, then taps toggle; a plain tap does nothing until M3 gives it the "add to board" action.
- **Quote parser heuristics** (not specified in detail by the blueprint): an author must be ≤ 8 words / 80 chars, start with a capital letter and not end like a sentence; a plain hyphen counts as a separator only with whitespace (or a closing quote) before it. This keeps "The journey — not the destination — matters" and "well-being" intact. Leading list bullets (`-`, `•`, `1.`) are stripped. Duplicates are compared ignoring case, punctuation and spacing.
- **Deferred to M4**: editing a quote in the library (the M4 criterion "a library edit shows on every card" is where it belongs). "Random quote" and "Add all unused" need a board and come with M3/M4.
- **Plural forms** in UI strings use `one|other` (en) and `one|few|other` (sr) via `Intl.PluralRules`.

## M2

- **Board page is minimal until M3**: editable title (autosaved) and the empty-board call to action. The editor, library sidebar and layouts arrive in M3.
- **Presets**: Inspiration Wall and Vision Board start in masonry; Moodboard starts in freeform (usable from M5); Blank starts in masonry. No preset changes the background yet: the theme default already fits all of them. The Vision Board section chips are in the UI language at creation time and are plain, renamable titles afterwards.
- **Empty title** becomes "Untitled board" / "Board bez naziva".
- **Duplicate** copies everything with a new board id; item ids are kept (they only need to be unique within a board).
- **Autosave**: `createSaver` debounces 500 ms, writes are chained so an older state never overwrites a newer one, and pending changes are flushed on `visibilitychange: hidden`, `pagehide`, when leaving a board and before a backup. Undo/redo (Immer patches) is left for M6; `boardStore.update()` is the single entry point it will hook into.
- **Backup format**: `data.json` (`format`, `version`, `exportedAt`, boards, assets, quotes, `blobs: id → {path, type}`) plus `images/<blobId>.<ext>`. Images are stored uncompressed in the zip (already compressed); only `data.json` is deflated. Output chunks are folded into Blobs every 32 MB so large libraries do not sit in one JS buffer.
- **Import**: into an empty app it imports directly; otherwise the user chooses Merge or Replace. Replace is one IndexedDB transaction, so a failure leaves the old data intact. Merge matches images by hash and quotes by normalized text to existing ids and rewrites board references; for a board present on both sides the newer `updatedAt` wins. Assets whose image files are missing from the zip are dropped instead of imported broken. The zip is read with `unzipSync`: with stored (uncompressed) entries this is essentially a copy.
- **Backup reminder**: shown when there are changes newer than the last backup and the last backup (or, if none, the first content) is older than 30 days. "Later" snoozes for 7 days. Exporting records `lastBackupAt` in the meta table.
- **Old backups**: `tests/fixtures/backup-v1.zip` is a committed v1 backup that a unit test must keep loading after any schema change (`WRITE_FIXTURES=1` regenerates it only on purpose).

## M3

- **Layout input**: instead of `sizes: Record<ID, {w, h}>` the engine gets `measure(item, width) → height` plus `gap`. Text cards only have a height for a given width, and the column width is decided inside the engine; a pure callback keeps the engine DOM-free. `ComputedLayout` also returns `blocks` (one per section) for hit testing.
- **Masonry defaults**: `minColumnWidth` 240 (the blueprint's "e.g. 260" gave only 2 columns beside the library and inspector). Auto columns are clamped to 2–6, which yields 2 on phones, 3 on tablets, 3–4 on desktop with both side panels and 5–6 full width. Manual columns go up to 8. Padding shrinks to 12px on screens under 600px.
- **Sections**: unsectioned cards form the first block (without a heading); every section is shown even when empty, as a dashed "Drop cards here" area so it can receive cards. Cards whose section was deleted count as unsectioned.
- **Month dividers**: months in ascending order; while on, they replace sections in the view (cards keep their `sectionId`, reordering does not change it). New cards get the current month.
- **Insertion point**: computed on the layout the user actually sees, ignoring placeholders; hovering a placeholder keeps the target. After a target change it is held for 120 ms so reflowing cards cannot make it oscillate, and the final target is recomputed from the pointer on drop. (Testing against the layout without the dragged cards looked stable but put cards one slot off on 2-column phones.)
- **Animation**: cards are absolutely positioned with `transform`, so a CSS `transform` transition (200 ms) gives the FLIP effect without measuring.
- **"End of the board"** (tap-to-add, "Add all unused", paste, upload button) means the last section when there are sections, otherwise the end of the list.
- **Intake in the editor**: files or web images dropped on the wall go to the library and onto the wall at the drop position; dropped elsewhere (e.g. the library sidebar) only into the library. Pasted images go to the library and the end of the board. An image that is already in the library is still placed on the board.
- **Touch**: dnd-kit `TouchSensor` with a 250 ms long press picks up library thumbnails and wall cards, so scrolling keeps working. A long press that ends without moving means "select" (library selection mode, or selecting the card), which unifies M1's long-press selection with dragging. A plain tap on a library thumbnail adds it to the end of the board; with a mouse, double-click does the same.
- **Inspector (minimal for now, M6 extends it)**: board settings without a selection (columns, spacing, month dividers, sections: add, rename, reorder, delete) and card settings with one (width 1–3 columns, remove). Delete/Backspace, Esc and Cmd/Ctrl+A already work on the wall.
- **Tablet and phone**: library and settings open as drawers from the header (M7 turns the phone library into the bottom strip).
- **Layouts without an engine yet** (freeform until M5) render with the masonry engine; their stored data is untouched.
- **Bug found and fixed**: an edit followed by an immediate reload could be lost, because Dexie starts writes asynchronously and the page was gone first. `BoardRepo.putNow()` now starts the IndexedDB transaction synchronously on `pagehide`/`visibilitychange`; an e2e test reloads right after an edit.

## M4

- **Edit / View switch** in the editor header (blueprint §8 "Režimi"): View hides the library and inspector, cards are not draggable, a click flips flip cards. Double-click to open a card fullscreen is left for M8, where it shares the lightbox with presentation mode.
- **Flip**: `flipped` is view state in the editor store (not saved). In Edit mode a small flip button sits on every flip card (always visible, not hover-only) and F flips the selected cards; in View mode a click flips. Space flips a focused flip card in both modes; Enter selects in Edit mode and flips in View mode. Reduced motion swaps the 3D rotation for a 180 ms crossfade. Only flip cards get the 3D structure (`perspective`, `preserve-3d`, `backface-visibility`); every 3D context is its own compositing layer, which was measurably expensive on long walls.
- **Card size comes from the front face.** A back face fits its text into the same box (11–28 px, auto-sized) instead of changing the layout when flipped.
- **Text over image**: the text box is inset 7% of the card width; "auto" size is the largest size (12 px minimum, max `min(64, width/7)`) whose box stays within 60% of the image area and 90% of its height (`layout/fit.ts`, pure and tested). If even 12 px does not fit, the inspector shows a warning and the text is clipped. New overlays start at bottom centre on a dark gradient at 70%.
- **Effect colors** (black/white over photos) are content styling, not UI chrome, so they are literal values in `overlayStyle.ts` rather than theme variables.
- **Text styles**: two fonts for now (Newsreader serif, Inter sans), size auto or fixed, weight 400–700, italic, alignment, color (auto follows the theme). Quote cards default to centred, text cards to left-aligned. Measurement and rendering share one function, so text cards never jump.
- **Dropping a quote**: onto the middle 70% of an image card → "Over the image / On the back" chooser; anywhere else → a new quote card at the drop position. While the target is "onto an image" the placeholder stays where it was, otherwise the wall would reflow, move the image away and make the target flicker. A drop below every card of a block now lands at the end of that block. The chooser buttons act on pointer-up (and keyboard clicks) because dnd-kit swallows the first click for ~50 ms after a drop.
- **Quote editing**: in the library (pencil on each quote) and in the inspector for quote cards, overlays and backs; both edit the library quote, so every card that uses it changes. Text cards and "own text" overlays/backs hold local text.
- **Random quote** prefers quotes not yet on the board. On touch, tapping a quote adds it to the end; with a mouse, double-click.
- **Only cards are inside the wall's `listbox`**; section headers, drop areas, the chooser and the add button are siblings (a listbox may only contain options, and browsers drop anything else from the accessibility tree).
- **Tests**: Playwright runs 3 workers (each page starts its own image worker pool; with more, this 15 GB machine swapped and pages stalled for seconds). The 1000-card wall and 100-photo upload checks are tagged `@perf` and run alone with `npm run e2e:perf`.

## After M4 (owner feedback)

- **Vision Board sections are opt-in**: the new-board dialog shows them unselected, so a Vision Board is one open board unless sections are chosen (blueprint: the preset *offers* optional sections). Inspiration Wall and Blank never have sections.
- **Board background** (MVP "osnovni stil: pozadina boarda"), in the board settings: Theme (default, follows light/dark), Color (8 calm swatches + any color) or Image from the library with a "Soften" veil (0–100%, default 30%) that is light or dark by choice (`veil`, default light; owner feedback: it must not always be white and may go all the way to 100%). The background is a fixed layer behind the scrolling wall, so long walls scroll over one image instead of stretching it; it uses the full-size image. `BoardBackground.image` gained optional `dim` and `veil` (backward compatible, no migration). Text drawn directly on the wall (section titles, empty areas, add button) switches between dark and light by the chosen color's luminance, or by the veil color once the veil is at least 15%; cards keep their own colors.
- **Dragging a quote** (reworked after an oscillation found in testing): anywhere on an image card means "onto the image"; in the gaps between cards the target does not change, so the wall does not reshuffle under the pointer; over a quote/text card or below all cards it inserts a new card. The chooser gained "As a separate card" (placed right after the image), so a quote can still go next to an image.
- The wall exposes `data-drop-onto` / `data-drop-index` for tests.
