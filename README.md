# Apon Niketon Holdings — Shareholder & Construction Management

Single-project web app (React 18, no backend). Data layer is an in-memory mock repository, ready to be swapped for Supabase (not connected). All data is fictional sample data.

## Build
    npm install
    node build.js          # -> apon-niketon.html (React from CDN, single file)
    node build.js local    # -> dist_local.html (React inlined, for offline tests)

`build.js` concatenates `src/` files in this order, compiles JSX with esbuild and inlines CSS:
00_core.js, 00b_logo.js (official logo as a data URL, from assets/logo.png), 01_seed.js, 02_repo.js, 03_calc.js, 04_services.js, 05_reports.js, 06_kit.jsx, 07_charts.jsx, 07b_files.jsx, 08_forms.jsx, 09_pages_a.jsx, 10_pages_b.jsx, 11_pages_c.jsx, 12_pages_d.jsx, 12b_print.jsx, 12c_project.jsx (Project Details + image gallery), 13_app.jsx, styles.css

## Layers
- 00 core utils, 01 sample seed, 02 repository + MockStorage (swap for Supabase / Storage)
- 03 calculations + validation, 04 services (audit, reversal, uploads), 05 reports
- 06–07b UI kit, charts, upload/preview/lightbox; 08–12 forms and pages; 12b A4 print documents; 13 app shell
- styles.css includes the A4 print CSS (`@page`, `#print-root`, `@media print`)

## Tests (need `npm i playwright-core`, Chromium)
    node tests/test_logic.js
    node build.js local && mkdir -p out shots && node tests/e2e.js

## Logo
`assets/logo_original.png` is the supplied file; `assets/logo.png` is the same image cropped to its bounds. `src/00b_logo.js` embeds it once and `BrandLogo` (06_kit.jsx) / `.doc-logo` (print) reuse it everywhere.
