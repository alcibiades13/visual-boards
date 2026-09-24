# Visual Boards — agent notes

- Read `docs/BLUEPRINT.md` first; it is the source of truth. Work milestone by milestone (§11) and stop for review after each one.
- Record decisions not covered by the blueprint in `docs/DECISIONS.md`; update `CHANGELOG.md` at the end of each milestone.
- Before reporting a milestone: `npm run check && npm run e2e`, and `npm run e2e:perf` (runs alone; heavy).
- Code and comments in English; UI strings go through `src/i18n` (en + sr).
- Never import `dexie` outside `src/data/`; keep `src/layout/` and `src/import/` pure (ESLint enforces both).
- Colors only via CSS variables in `src/styles/tokens.css`.
