import { useState, useCallback, useRef } from 'react'
import { fetchNpmPackage, fetchOSVVulns, buildPrompt, derivePackageStats, scorePackage } from '../lib/api'
import type { NpmPackageData, PackageStats, Vuln, Scores } from '../lib/api'
import type { RunInference } from './useWebLLM'

const STORAGE_KEY = 'pkgaudit_recent'

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[] } catch { return [] }
}
function addRecent(name: string): void {
  try {
    const r = getRecent().filter(x => x !== name)
    r.unshift(name)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(r.slice(0, 8)))
  } catch { /* ignore storage errors */ }
}

export interface AiState {
  text: string
  status: 'idle' | 'streaming' | 'done' | 'error'
  error?: string
}

export interface ScanState {
  phase: 'search' | 'loading' | 'report' | 'error'
  query: string
  npm: NpmPackageData | null
  stats: PackageStats | null
  vulns: Vuln[]
  scores: Scores | null
  ai: AiState
  error: string | null
}

export function usePackageScan(runInference: RunInference) {
  const [state, setState] = useState<ScanState>({
    phase:   'search',
    query:   '',
    npm:     null,
    stats:   null,
    vulns:   [],
    scores:  null,
    ai:      { text: '', status: 'idle' },
    error:   null,
  })

  const abortRef = useRef<AbortController | null>(null)

  const scan = useCallback(async (pkgName: string) => {
    if (!pkgName?.trim()) return
    const name = pkgName.trim().toLowerCase()

    abortRef.current?.abort?.()

    setState(s => ({ ...s, phase: 'loading', query: name, error: null, ai: { text: '', status: 'idle' } }))

    try {
      const [npm, vulns] = await Promise.all([
        fetchNpmPackage(name),
        fetchOSVVulns(name),
      ])

      if (!npm) throw new Error(`"${name}" not found on npm`)

      const stats  = derivePackageStats(npm)
      const scores = scorePackage(stats, vulns)

      addRecent(name)

      setState(s => ({ ...s, phase: 'report', npm, stats, vulns, scores, error: null }))

      const controller = new AbortController()
      abortRef.current = controller

      setState(s => ({ ...s, ai: { text: '', status: 'streaming' } }))

      const prompt = buildPrompt({
        name:          stats.name,
        version:       stats.latest,
        description:   stats.description,
        license:       stats.license,
        maintainers:   stats.maintainers,
        totalVersions: stats.totalVersions,
        deps:          stats.deps,
        vulns,
      })

      await runInference(
        prompt,
        (chunk) => setState(s => ({
          ...s,
          ai: { ...s.ai, text: s.ai.text + chunk },
        })),
        () => setState(s => ({ ...s, ai: { ...s.ai, status: 'done' } })),
        (err) => setState(s => ({ ...s, ai: { ...s.ai, status: 'error', error: err } })),
      )
    } catch (err) {
      setState(s => ({ ...s, phase: 'error', error: (err as Error).message }))
    }
  }, [runInference])

  const reset = useCallback(() => {
    abortRef.current?.abort?.()
    setState(s => ({ ...s, phase: 'search', query: '', npm: null, stats: null, vulns: [], scores: null, ai: { text: '', status: 'idle' }, error: null }))
  }, [])

  return { state, scan, reset, getRecent }
}
