# CLAUDE.md

This project is being migrated to TypeScript and WebLLM browser inference.
There are two tasks below. Do them in order.

---

## Task 1 — migrate to TypeScript

### Steps

1. Install dev dependencies:

```bash
npm install -D typescript @types/react @types/react-dom
```

2. Create `tsconfig.json` in the project root:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"]
}
```

3. Rename `vite.config.js` → `vite.config.ts`. No content changes needed.

4. Rename every file in `src/`:

```
src/main.jsx              → src/main.tsx
src/App.jsx               → src/App.tsx
src/index.css             (no change)
src/lib/api.js            → src/lib/api.ts
src/hooks/usePackageScan.js → src/hooks/usePackageScan.ts
src/components/AIPanel.jsx    → src/components/AIPanel.tsx
src/components/ReportView.jsx → src/components/ReportView.tsx
src/components/SearchView.jsx → src/components/SearchView.tsx
src/components/ui.jsx         → src/components/ui.tsx
```

5. Update `index.html` script src to point at `src/main.tsx`.

### Types to define

Create `src/types.ts` with these shared types. Import from here rather than
redefining inline:

```ts
export type Severity =
  | 'critical'
  | 'high'
  | 'moderate'
  | 'medium'
  | 'low'
  | 'unknown'

export interface Vuln {
  id: string
  summary: string
  details: string
  severity: Severity
  cves: string[]
  aliases: string[]
  published: string | undefined
  modified: string | undefined
  withdrawn: string | undefined
  fixedIn: string | null
  references: string[]
}

export interface PackageStats {
  name: string
  latest: string
  meta: Record<string, unknown>
  allVersions: string[]
  deps: string[]
  devDeps: string[]
  peerDeps: string[]
  created: Date | null
  modified: Date | null
  monthsSinceUpdate: number | null
  avgReleaseCadenceDays: number | null
  maintainers: string[]
  license: string
  description: string
  homepage: string
  repoUrl: string
  engines: Record<string, string> | null
  hasTypes: boolean
  isScoped: boolean
  bundleSize: number | null
  totalVersions: number
}

export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type Verdict = 'pass' | 'warn' | 'block'

export interface Scores {
  secScore: ScoreGrade
  depScore: ScoreGrade
  maintScore: ScoreGrade
  matScore: ScoreGrade
  verdict: Verdict
  activeCrit: number
  activeHigh: number
  activeMod: number
  patchedCrit: number
  patchedHigh: number
  totalVulns: number
}

export type ScanPhase = 'search' | 'loading' | 'report' | 'error'
export type AIStatus = 'idle' | 'streaming' | 'done' | 'error'

export interface AIState {
  text: string
  status: AIStatus
}

export interface ScanState {
  phase: ScanPhase
  query: string
  npm: Record<string, unknown> | null
  stats: PackageStats | null
  vulns: Vuln[]
  scores: Scores | null
  ai: AIState
  error: string | null
}
```

### Notes on annotating each file

**`api.ts`**

- `fetchNpmPackage` returns `Promise<Record<string, unknown> | null>`
- `fetchNpmSearch` returns `Promise<Array<{ name: string; description?: string }>>`
- `fetchOSVVulns` returns `Promise<Vuln[]>`
- `derivePackageStats` takes `Record<string, unknown>`, returns `PackageStats`
- `scorePackage` takes `PackageStats` and `Vuln[]`, returns `Scores`
- `streamAnalysis` takes a pkg object and three callbacks; return type `Promise<void>`
- Internal helpers (`extractFixedVersion`, `semverCompare`, etc.) can stay untyped
  or use simple `string[]` / `string` annotations — don't over-engineer them

**`usePackageScan.ts`**

- Return type: `{ state: ScanState; scan: (name: string) => Promise<void>; reset: () => void; getRecent: () => string[] }`
- `useState` calls should infer from the initial value where possible; annotate
  explicitly only where TypeScript can't infer (e.g. `useState<ScanState>(...)`)

**`ui.tsx`**

- Each component gets a `Props` interface defined just above it, not exported
  unless used elsewhere
- `VerdictBanner` props: `{ verdict: Verdict; text?: string }`
- `ScoreChip` props: `{ grade: ScoreGrade; label: string; sub?: string | number }`
- `Badge` props: `{ sev: string }` — keep loose, severity display is presentational
- `MetaRow` props: `{ label: string; value: React.ReactNode }`
- `Card` props: `{ children: React.ReactNode; style?: React.CSSProperties }`

**`AIPanel.tsx`**

- Props: `{ ai: AIState }`

**`ReportView.tsx`**

- Props: `{ state: ScanState; onBack: () => void }`

**`SearchView.tsx`**

- Props: `{ onSearch: (name: string) => void; getRecent: () => string[] }`

**`App.tsx`**

- No props (root component)

### What not to do

- Do not add `any` except as a last resort. If something is genuinely unknown,
  use `unknown` and narrow it.
- Do not install extra type packages beyond `@types/react` and `@types/react-dom`.
- Do not rewrite logic — this is a rename + annotation pass only.
- Run `npx tsc --noEmit` at the end and fix any errors before moving to Task 2.

---

## Task 2 — WebLLM browser inference

Replace the server-side AI proxy (`/api/analyse`) with in-browser inference via
WebLLM (WebGPU). The model runs entirely client-side. No server, no API key,
no cost per request after the one-time download.

### Install

```bash
npm install @mlc-ai/web-llm
```

### New types to add to `src/types.ts`

```ts
export type WebLLMStatus = 'idle' | 'loading' | 'ready' | 'inferring' | 'error'

export interface WebLLMState {
  status: WebLLMStatus
  progress: number // 0–100
  progressLabel: string
  cached: boolean
  error: string | null
}
```

### New file: `src/hooks/useWebLLM.ts`

This hook owns the entire model lifecycle.

```ts
import { useState, useRef, useEffect } from 'react'
import { CreateMLCEngine, MLCEngine } from '@mlc-ai/web-llm'
import { WebLLMState } from '../types'

const MODEL_ID = 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC'
const CACHE_KEY = 'webllm/model'

export function useWebLLM() {
  const [state, setState] = useState<WebLLMState>({
    status: 'idle',
    progress: 0,
    progressLabel: '',
    cached: false,
    error: null,
  })
  const engineRef = useRef<MLCEngine | null>(null)

  // Check cache on mount — don't load, just update the cached flag
  useEffect(() => {
    caches.has(CACHE_KEY).then(cached => {
      setState(s => ({ ...s, cached }))
    }).catch(() => {})
  }, [])

  async function loadModel() { ... }

  async function runInference(
    prompt: string,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: string) => void
  ) { ... }

  return { state, loadModel, runInference }
}
```

Implement `loadModel` using `CreateMLCEngine` with `initProgressCallback`.
The callback receives `{ progress: number; text: string }` where `progress`
is 0–1 — multiply by 100 and round for the UI.

Implement `runInference` using `engineRef.current.chat.completions.create`
with `stream: true`. Iterate the async stream and call `onChunk` for each
delta. Call `onDone` when the stream ends. Catch errors and call `onError`.

### Model details

Primary model: `Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC` (~4.5 GB, one-time download)
Fallback: `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` (~900 MB, weaker reasoning)

### UI: `AIPanel.tsx`

Add props `webllm: WebLLMState` and `onRequestLoad: () => void`.

Render based on `webllm.status`:

**`idle`, `cached: false`** — show a download prompt:

```
Run AI analysis locally in your browser

Qwen2.5-Coder 7B · ~4.5 GB · one-time download
Cached after first use — no re-download on future visits
Requires WebGPU (Chrome 113+, Edge 113+)

[ Download and run locally ]
```

Button calls `onRequestLoad()`. Nothing downloads until this click.

**`idle`, `cached: true`** — shorter prompt:

```
Local model cached

[ Load model ]
```

**`loading`** — progress bar:

```
Loading model...
[████████████░░░░░░░░] 67%
Fetching param cache[8/12]: 89%
```

Progress bar is a plain div track + fill. Width = `state.progress + '%'`.
Label below is `state.progressLabel` verbatim.
No cancel button — WebLLM doesn't support clean cancellation.

**`ready` / `inferring` / `done` / `error`** — existing streaming display,
no changes.

**WebGPU check** — at the top of AIPanel, before anything else:

```ts
const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu
```

If false, render a static message instead of the download prompt:

```
AI analysis requires WebGPU
Supported in Chrome 113+ and Edge 113+
Firefox and Safari not yet supported
```

### `App.tsx` changes

Instantiate `useWebLLM()` at the root level — not inside ReportView.
The engine must survive across package scans.

```tsx
const { state: webllm, loadModel, runInference } = useWebLLM()
```

Pass `webllm` and `loadModel` down: `App` → `ReportView` → `AIPanel`.
Pass `runInference` into `usePackageScan` to replace `streamAnalysis`.

### `usePackageScan.ts` changes

Accept `runInference` as a parameter (or import it — either works).
Replace the `streamAnalysis('/api/analyse', ...)` call with `runInference(prompt, ...)`.

Move `buildPrompt()` from `server/index.js` into `src/lib/api.ts` so the
client can call it. The function signature:

```ts
export function buildPrompt(pkg: {
  name: string
  version: string
  description: string
  license: string
  maintainers: string
  totalVersions: number
  deps: { count: number; list: string }
  vulns: Array<{
    id: string
    severity: string
    summary: string
    fixedIn: string | null
  }>
}): string
```

### What to remove after Task 2

- The `/api/analyse` route from `server/index.js` (keep `/api/osv/batch` if
  lockfile mode is still wanted)
- `streamAnalysis` from `src/lib/api.ts`
- The Vite proxy entry for `/api` in `vite.config.ts` if the server is fully removed
- `concurrently` from package.json scripts if the server is fully removed

### Implementation order for Task 2

1. Add `WebLLMState` / `WebLLMStatus` to `src/types.ts`
2. Write `useWebLLM.ts` — verify `loadModel` and progress callback work in isolation
3. Update `AIPanel.tsx` — idle / cached / loading states
4. Move `buildPrompt` into `src/lib/api.ts`
5. Wire `runInference` into `usePackageScan.ts`
6. Thread `webllm` + `loadModel` through `App.tsx` → `ReportView` → `AIPanel`
7. Run `npx tsc --noEmit` — fix any errors
8. Manual test: idle → click → progress bar → inference → streaming text
9. Remove dead server code
