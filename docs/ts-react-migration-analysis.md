# TypeScript + React Migration Analysis

An effort estimate for migrating the Electron stock research app from plain JavaScript to TypeScript and React.

## Current Codebase Snapshot

| Area | Files | ~Lines | Notes |
|------|-------|--------|-------|
| **Main process** | `main.js`, `edgarService.js` | ~845 | IPC handlers, alerts checker, EDGAR service |
| **Renderer** | `renderer.js`, `alerts.js`, `edgar.js`, `chart.js`, `utils.js`, `dom.js` | ~1,276 | Vanilla JS, imperative DOM manipulation |
| **Support** | `i18n.js`, `preload.js` | ~121 | contextBridge, IPC wiring |
| **HTML/CSS** | `index.html`, `styles.css` | ~1,240 | Single HTML file, plain CSS |

**Total: ~2,250 lines of JS, no build step, scripts loaded via `<script>` tags.**

## Migration Effort Estimate

### 1. Project Setup (Low–Medium: 1–2 days)

- Add TypeScript + build tooling (e.g. Vite + electron-vite, or electron-forge)
- Configure tsconfig for main + renderer
- Set up Electron packaging with TypeScript output
- Add types for Electron and existing deps

### 2. Main Process → TypeScript (Low: 0.5–1 day)

- Rename `main.js` → `main.ts`, `edgarService.js` → `edgarService.ts`
- Add types for IPC payloads, alerts, API responses
- Minimal logic changes; mostly typing

### 3. Preload → TypeScript (Low: ~0.25 day)

- Add type definitions for `contextBridge.exposeInMainWorld` APIs
- Define an interface for `window.stockApi`, `window.alertsApi`, etc., for renderer typing

### 4. Renderer → React (High: 4–8 days)

This is the largest chunk:

- **UI breakdown:** Search bar, results list, quote panel, financials, ETF, EDGAR, alerts
- **Reasonable component split:** ~15–25 components (e.g. `SearchBar`, `ResultsList`, `QuotePanel`, `FinancialsTab`, `EdgarTab`, `AlertsScreen`, `HistoryChart`, etc.)
- **State:** Current `App.state` becomes React state + possibly context (e.g. `currentSymbol`, `currentIsEtf`)
- **DOM logic:** All `innerHTML`, `createElement`, `addEventListener` replaced by JSX + React state/handlers
- **ECharts:** Integrate via `echarts-for-react` or manual `useEffect` wrapper
- **Tabs:** Replace manual show/hide with React components and state

### 5. i18n Integration (Low–Medium: 0.5–1 day)

- Keep `translations.yaml` and adapt existing loader, or move to `react-i18next` + JSON/YAML
- Replace `App.t()` with chosen i18n API in React components

### 6. Styling (Low–Medium: 0.5–1 day)

- Keep existing CSS, or adopt CSS modules / styled-components / Tailwind
- Update selectors if React generates different class names

### 7. Testing & Bug Fixes (Medium: 1–2 days)

- End-to-end verification of search, quote, financials, ETF, EDGAR, alerts, charts
- Fix IPC/type mismatches, edge cases
- Packaging and build verification

## Summary by Approach

| Approach | Effort | Notes |
|----------|--------|-------|
| **TypeScript only** (main + preload + renderer) | **2–3 days** | Add types; keep vanilla JS, no structural change |
| **TypeScript + React** (full migration) | **8–15 days** | 1–2 weeks for one dev familiar with React |
| **Phased: TypeScript first, then React** | Same total | Lower risk; TS first, then migrate renderer to React in chunks |

## Complexity Factors

1. **Global `window.App`:** State and DOM refs are shared across scripts. React prefers explicit state/props; refactor is nontrivial.
2. **ECharts:** Needs a React wrapper (`echarts-for-react`) or careful `useEffect` integration with cleanup.
3. **IPC:** Types must be defined and kept in sync between main and renderer.
4. **Single-page, many panels:** Tabs/screens are toggled imperatively; React will centralize this in state.
5. **No existing tests:** Manual regression testing is required post-migration.

## Recommendation

- **TypeScript only:** 2–3 days, moderate risk.
- **Full TypeScript + React:** 1–2 weeks for a careful migration and testing.
- **Phased:** Start with TypeScript (main + preload + renderer), then migrate the renderer to React component-by-component (e.g. alerts first, then search/quote, then EDGAR/financials).
