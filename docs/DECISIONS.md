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
