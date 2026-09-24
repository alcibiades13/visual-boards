# Changelog

## M0 — Foundation (2026-09-24)

- Vite 8 + React 18 + TypeScript strict, Tailwind v4, Zustand, Immer, Dexie, dnd-kit, Vitest, Playwright, ESLint.
- Data model from blueprint §4 in `src/model/` with factories, schema migration entry point and computed usage index.
- Repository layer (`BoardRepo`, `AssetRepo`, `QuoteRepo`, `BlobRepo`, `MetaRepo`) with a Dexie implementation and tests on fake-indexeddb.
- Light/dark theme through CSS variables, self-hosted Newsreader + Inter.
- `navigator.storage.persist()` requested on first run.
- App shell: hash router, empty dashboard, board route placeholder, English/Serbian UI.
- Playwright smoke test at 1440, 1024 and 390px.
