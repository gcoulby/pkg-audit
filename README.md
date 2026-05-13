# pkg / audit

Search any npm package and get a live security + quality report — CVEs from OSV, npm metadata, and an AI-powered "do you even need this" assessment that runs entirely in your browser.

## What it checks

- **Security** — live CVE lookup via [OSV.dev](https://osv.dev), severity grades A–F, patched-vs-active distinction
- **Dependency weight** — runtime dep count, grade A–D
- **Maintenance** — time since last publish, version cadence
- **Maturity** — version history depth
- **AI analysis** — streams a blunt audit using Qwen2.5-Coder 7B running locally via WebGPU: security context, dep weight, and whether you could replace the package with 10 lines of native JS

No server. No API key. No cost per request.

## Requirements

- **Chrome 113+** or **Edge 113+** — WebGPU required for AI analysis
- First run downloads ~4.5 GB model, cached in the browser after that

## Setup

```bash
pnpm install
pnpm dev
```

Opens at `http://localhost:5173`. No `.env` needed.

## Production build

```bash
pnpm build
pnpm preview
```

Outputs a static `dist/` folder — deploy anywhere (Netlify, S3, GitHub Pages, etc).

## Deploy to GitHub Pages

Push to `main`. The included [GitHub Actions workflow](.github/workflows/deploy.yml) builds and deploys automatically.

One-time setup: repo Settings → Pages → Source → **GitHub Actions**.

## Architecture

```
src/
  App.tsx                   Root — phase-based routing (search / loading / report / error)
  components/
    SearchView.tsx          Landing page with autocomplete + model load widget
    ReportView.tsx          Tabbed report (security / info / deps / versions)
    AIPanel.tsx             Model lifecycle UI + streaming analysis display
    ui.tsx                  Badge, ScoreChip, Spinner, Card, MetaRow, VerdictBanner
  hooks/
    useWebLLM.ts            Model lifecycle — download, init, inference streaming
    usePackageScan.ts       Orchestrates all fetching + inference state
  lib/
    api.ts                  npm registry, OSV, scoring logic, prompt builder
```

## Data sources

| Source | What it provides |
|--------|-----------------|
| `registry.npmjs.org` | Package metadata, versions, deps, maintainers, bundle size |
| `registry.npmjs.org/-/v1/search` | Autocomplete suggestions |
| `api.osv.dev/v1/query` | Live CVEs and security advisories |
| WebLLM (browser) | In-browser AI audit via Qwen2.5-Coder 7B |

## AI model

| Model | Size | Notes |
|-------|------|-------|
| `Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC` | ~4.5 GB | Default — good reasoning, requires a discrete GPU |
| `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` | ~900 MB | Fallback — works on integrated graphics |

The model is cached in the browser's Cache API after the first download. Subsequent visits load from cache in ~2 seconds with no network request.
