# Visual Boards

A local-first web app for collecting photos and quotes and composing them into inspiration walls, vision boards and moodboards.

> You bring the inspiration. The app helps you arrange it.

- Specification: [docs/BLUEPRINT.md](docs/BLUEPRINT.md) (source of truth)
- Implementation plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Decisions not covered by the blueprint: [docs/DECISIONS.md](docs/DECISIONS.md)
- Progress: [CHANGELOG.md](CHANGELOG.md)

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + unit tests
npm run e2e        # Playwright smoke tests (desktop, tablet, phone)
npm run build
```

All data stays in the browser (IndexedDB). There is no server.
