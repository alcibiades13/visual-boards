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
