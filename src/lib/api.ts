const NPM_REGISTRY = 'https://registry.npmjs.org'
const OSV_API = 'https://api.osv.dev/v1'

// --- Types ---

export interface NpmVersionMeta {
  license?: string
  homepage?: string
  repository?: { url?: string }
  engines?: Record<string, string>
  types?: string
  typings?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  dist?: { unpackedSize?: number }
}

export interface NpmPackageData {
  name: string
  description?: string
  license?: string
  homepage?: string
  repository?: { url?: string }
  maintainers?: Array<{ name: string }>
  'dist-tags'?: { latest?: string }
  versions?: Record<string, NpmVersionMeta>
  time?: Record<string, string>
}

export interface NpmSearchItem {
  name: string
  description?: string
}

export interface Vuln {
  id: string
  summary: string
  details: string
  severity: string
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
  meta: NpmVersionMeta
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

export interface Scores {
  secScore: string
  depScore: string
  maintScore: string
  matScore: string
  verdict: 'pass' | 'warn' | 'block'
  activeCrit: number
  activeHigh: number
  activeMod: number
  patchedCrit: number
  patchedHigh: number
  totalVulns: number
}

// --- npm registry ---

export async function fetchNpmPackage(
  name: string,
): Promise<NpmPackageData | null> {
  const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`npm registry error: ${res.status}`)
  return res.json() as Promise<NpmPackageData>
}

export async function fetchNpmSearch(
  query: string,
  size = 7,
): Promise<NpmSearchItem[]> {
  const res = await fetch(
    `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`,
  )
  if (!res.ok) return []
  const data = (await res.json()) as {
    objects?: Array<{ package: NpmSearchItem }>
  }
  return (data.objects || []).map((o) => o.package)
}

// --- OSV ---

interface OsvAffected {
  ranges?: Array<{
    events?: Array<{ introduced?: string; fixed?: string }>
  }>
}

interface OsvVuln {
  id: string
  summary?: string
  details?: string
  aliases?: string[]
  published?: string
  modified?: string
  withdrawn?: string
  references?: Array<{ url?: string }>
  severity?: Array<{ type?: string; score?: string }>
  database_specific?: { severity?: string }
  affected?: OsvAffected[]
}

export async function fetchOSVVulns(name: string): Promise<Vuln[]> {
  try {
    const res = await fetch(`${OSV_API}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name, ecosystem: 'npm' } }),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { vulns?: OsvVuln[] }
    return (data.vulns || []).map(normaliseVuln)
  } catch {
    return []
  }
}

function extractFixedVersion(affected: OsvAffected[]): string | null {
  const fixed: string[] = []
  for (const a of affected) {
    for (const range of a.ranges || []) {
      for (const event of range.events || []) {
        if (event.fixed) fixed.push(event.fixed)
      }
    }
  }
  if (!fixed.length) return null
  return fixed.sort(semverCompare)[0]
}

function semverCompare(a: string, b: string): number {
  const pa = a
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map(Number)
  const pb = b
    .replace(/[^0-9.]/g, '')
    .split('.')
    .map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function isFixedInOrBefore(fixedIn: string, currentVersion: string): boolean {
  return semverCompare(fixedIn, currentVersion) <= 0
}

function normaliseVuln(v: OsvVuln): Vuln {
  const sev =
    v.database_specific?.severity ||
    v.severity?.[0]?.type?.replace('CVSS_V3', '').toLowerCase() ||
    scoreToBand(v.severity?.[0]?.score) ||
    'unknown'

  const cves = (v.aliases || []).filter((a) => /^CVE-/.test(a))
  const fixedIn = extractFixedVersion(v.affected || [])

  return {
    id: v.id,
    summary: v.summary || '',
    details: v.details || '',
    severity: sev.toLowerCase(),
    cves,
    aliases: v.aliases || [],
    published: v.published,
    modified: v.modified,
    withdrawn: v.withdrawn,
    fixedIn,
    references: (v.references || [])
      .map((r) => r.url)
      .filter((u): u is string => Boolean(u)),
  }
}

function scoreToBand(score: string | undefined): string | null {
  if (!score) return null
  const n = parseFloat(score)
  if (n >= 9) return 'critical'
  if (n >= 7) return 'high'
  if (n >= 4) return 'moderate'
  return 'low'
}

// --- Prompt builder ---

export function buildPrompt(pkg: {
  name: string
  version: string
  description: string
  license: string
  maintainers: string[]
  totalVersions: number
  deps: string[]
  vulns: Vuln[]
}): string {
  const {
    name,
    version,
    description,
    license,
    maintainers,
    totalVersions,
    deps,
    vulns,
  } = pkg

  const depsList =
    deps.slice(0, 25).join(', ') + (deps.length > 25 ? '...' : '')
  const vulnLines =
    vulns.length === 0
      ? 'No known vulnerabilities.'
      : vulns
          .slice(0, 8)
          .map(
            (v) =>
              `- ${v.id} (${v.severity || '?'}): ${v.summary || 'no summary'}`,
          )
          .join('\n')

  return (
    'You are a blunt, expert Node.js security reviewer. A developer is deciding whether to add this npm package.\n\n' +
    `Package: ${name}\n` +
    `Version: ${version}\n` +
    `Description: ${description || 'none'}\n` +
    `License: ${license || 'unknown'}\n` +
    `Maintainers: ${maintainers.join(', ') || 'unknown'}\n` +
    `Total published versions: ${totalVersions}\n` +
    `Runtime dependencies (${deps.length}): ${depsList}\n` +
    `Known vulnerabilities:\n${vulnLines}\n\n` +
    'Write a concise audit with exactly these 4 section headers on their own line, nothing before the first header:\n\n' +
    'SECURITY\n' +
    'Assess the CVE situation. Are the vulns patched in newer versions? Is the advisory history concerning or routine?\n\n' +
    'DEPENDENCY WEIGHT\n' +
    'How heavy is this package? Does it pull in a lot of transitive deps? Is the dep tree appropriate for what it does?\n\n' +
    'DO YOU EVEN NEED THIS\n' +
    "This is the most important section. Be ruthless. Could a developer replace this with 5-10 lines of native JS or built-in Node APIs? If yes, say exactly what they'd write instead. Only credit the package if it genuinely handles complex edge cases, browser compatibility nightmares, or encoding/parsing logic that's genuinely hard to get right. Call out lazy installs directly. Do not hedge. Do not say 'you might consider'. If it can be replaced with one line of JS, say so and write that line. Small packages that do trivially simple things are lazy — say so. Large packages like react or vue do real heavy lifting and should be credited accordingly.\n\n" +
    'VERDICT\n' +
    'One clear recommendation: use it / avoid it / use it with conditions. State the version to pin to if applicable.\n\n' +
    'Plain text only. No markdown, no backticks, no code fences. For code examples indent with 2 spaces. Under 380 words total.'
  )
}

// --- Derived stats ---

export function derivePackageStats(npm: NpmPackageData): PackageStats {
  const latest = npm['dist-tags']?.latest || '?'
  const meta = npm.versions?.[latest] || {}
  const allVersions = Object.keys(npm.versions || {})
  const time = npm.time || {}

  const deps = Object.keys(meta.dependencies || {})
  const devDeps = Object.keys(meta.devDependencies || {})
  const peerDeps = Object.keys(meta.peerDependencies || {})

  const created = time['created'] ? new Date(time['created']) : null
  const modified = time['modified'] ? new Date(time['modified']) : null

  const monthsSinceUpdate = modified
    ? Math.floor((Date.now() - modified.getTime()) / (1000 * 60 * 60 * 24 * 30))
    : null

  const recentVersionTimes = allVersions
    .slice(-10)
    .map((v) => (time[v] ? new Date(time[v]).getTime() : null))
    .filter((t): t is number => t !== null)
    .sort()

  let avgReleaseCadenceDays: number | null = null
  if (recentVersionTimes.length >= 2) {
    const span =
      recentVersionTimes[recentVersionTimes.length - 1] - recentVersionTimes[0]
    avgReleaseCadenceDays = Math.round(
      span / (recentVersionTimes.length - 1) / (1000 * 60 * 60 * 24),
    )
  }

  const maintainers = (npm.maintainers || []).map((m) => m.name)
  const license = meta.license || npm.license || 'unknown'
  const description = npm.description || ''
  const homepage = meta.homepage || npm.homepage || ''
  const repoUrl = (meta.repository?.url || npm.repository?.url || '')
    .replace(/^git\+|\.git$/g, '')
    .replace('git://', 'https://')
  const engines = meta.engines || null
  const types = meta.types || meta.typings || null
  const baseName = npm.name?.split('/').pop() ?? ''
  const hasTypes = !!(types || devDeps.includes('@types/' + baseName))
  const isScoped = npm.name?.startsWith('@') ?? false
  const bundleSize = meta.dist?.unpackedSize || null

  return {
    name: npm.name,
    latest,
    meta,
    allVersions,
    deps,
    devDeps,
    peerDeps,
    created,
    modified,
    monthsSinceUpdate,
    avgReleaseCadenceDays,
    maintainers,
    license,
    description,
    homepage,
    repoUrl,
    engines,
    hasTypes,
    isScoped,
    bundleSize,
    totalVersions: allVersions.length,
  }
}

// --- Scoring ---

export function scorePackage(stats: PackageStats, vulns: Vuln[]): Scores {
  const { deps, allVersions, monthsSinceUpdate, latest } = stats

  const active = vulns.filter(
    (v) => !v.fixedIn || !isFixedInOrBefore(v.fixedIn, latest),
  )
  const patched = vulns.filter(
    (v) => v.fixedIn && isFixedInOrBefore(v.fixedIn, latest),
  )

  const activeCrit = active.filter((v) => v.severity === 'critical').length
  const activeHigh = active.filter((v) => v.severity === 'high').length
  const activeMod = active.filter((v) =>
    ['moderate', 'medium'].includes(v.severity),
  ).length
  const patchedCrit = patched.filter((v) => v.severity === 'critical').length
  const patchedHigh = patched.filter((v) => v.severity === 'high').length

  const secScore =
    activeCrit > 0
      ? 'F'
      : activeHigh > 0
        ? 'D'
        : activeMod > 0
          ? 'C'
          : patchedCrit > 0 || patchedHigh > 0
            ? 'B'
            : vulns.length === 0
              ? 'A'
              : 'B'

  const depScore =
    deps.length === 0
      ? 'A'
      : deps.length <= 4
        ? 'B'
        : deps.length <= 12
          ? 'C'
          : 'D'

  const maintScore =
    monthsSinceUpdate === null
      ? 'C'
      : monthsSinceUpdate <= 6
        ? 'A'
        : monthsSinceUpdate <= 18
          ? 'B'
          : monthsSinceUpdate <= 36
            ? 'C'
            : 'D'

  const matScore =
    allVersions.length >= 30
      ? 'A'
      : allVersions.length >= 10
        ? 'B'
        : allVersions.length >= 3
          ? 'C'
          : 'D'

  const verdict: Scores['verdict'] =
    activeCrit > 0
      ? 'block'
      : activeHigh > 0
        ? 'warn'
        : depScore === 'D'
          ? 'warn'
          : maintScore === 'D'
            ? 'warn'
            : 'pass'

  return {
    secScore,
    depScore,
    maintScore,
    matScore,
    verdict,
    activeCrit,
    activeHigh,
    activeMod,
    patchedCrit,
    patchedHigh,
    totalVulns: vulns.length,
  }
}

export const SEV_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  moderate: 3,
  medium: 2,
  low: 1,
  unknown: 0,
}
