# Changelog

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
