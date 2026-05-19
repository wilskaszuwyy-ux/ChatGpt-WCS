# AGENTS.md

## Cursor Cloud specific instructions

This is a zero-dependency static HTML/JS/CSS dashboard (no `node_modules`, no build step, no framework).

### Running

- **Tests:** `npm test` (uses Node.js built-in `node:test` runner; requires Node 18+)
- **Dev server:** `npm start` (runs `python3 -m http.server 4173`); visit `http://localhost:4173`
- No linter is configured in this project.
- No build step exists; `npm run build` simply runs the smoke test.

### Known issues

- The dashboard has a pre-existing browser JavaScript error: `dashboardLogic.js` declares global functions (e.g. `calculateComponentTotals`) and `app.js` re-declares them via `const` destructuring, causing `SyntaxError: Identifier already declared` in browsers. Tests pass because they use dynamic `import()` (module scope). This is a code bug, not an environment issue.

### Architecture

- `index.html` — entry point, loads scripts as classic (non-module) `<script>` tags
- `src/reportData.js` — all report data hardcoded on `globalThis.reportData`
- `src/dashboardLogic.js` — pure utility functions on `globalThis.dashboardLogic`
- `src/app.js` — renders the full dashboard DOM
- `src/pdfData.js` — base64-embedded PDF (lazy-loaded in browser)
- `test/smoke.test.js` — structural/offline checks
- `test/data.test.js` — data integrity and business logic tests
