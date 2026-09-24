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
