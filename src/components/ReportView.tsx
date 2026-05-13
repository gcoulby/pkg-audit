import { useState } from 'react'
import {
  Badge,
  ScoreChip,
  VerdictBanner,
  Card,
  MetaRow,
  SectionHead,
} from './ui'
import AIPanel from './AIPanel'
import type { ScanState } from '../hooks/usePackageScan'
import type { Vuln } from '../lib/api'
import type { WebLLMState } from '../hooks/useWebLLM'

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString()
}

function fmtDate(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' kB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function DepGrid({ deps, muted }: { deps: string[]; muted?: boolean }) {
  if (!deps.length)
    return <p style={{ fontSize: 13, color: 'var(--text3)' }}>none</p>
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 6,
      }}
    >
      {deps.map((d) => (
        <div
          key={d}
          style={{
            background: 'var(--bg2)',
            borderRadius: 6,
            padding: '5px 9px',
            fontSize: 11,
            fontFamily: 'var(--mono)',
            color: muted ? 'var(--text3)' : 'var(--text2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {d}
        </div>
      ))}
    </div>
  )
}

function VulnCard({ vuln }: { vuln: Vuln }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Card
      style={{ marginBottom: 8, cursor: vuln.details ? 'pointer' : 'default' }}
      onClick={() => vuln.details && setExpanded((e) => !e)}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          flexWrap: 'wrap',
        }}
      >
        <Badge sev={vuln.severity} />
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 12,
            color: 'var(--text2)',
          }}
        >
          {vuln.id}
        </span>
        {vuln.cves.map((c) => (
          <span
            key={c}
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--text3)',
            }}
          >
            {c}
          </span>
        ))}
        {vuln.details && (
          <span
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}
          >
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
        {vuln.summary}
      </div>
      {expanded && vuln.details && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text2)',
            marginTop: 8,
            lineHeight: 1.6,
            borderTop: '0.5px solid var(--border)',
            paddingTop: 8,
          }}
        >
          {vuln.details.slice(0, 600)}
          {vuln.details.length > 600 ? '...' : ''}
        </div>
      )}
      {vuln.references?.length > 0 && expanded && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {vuln.references.slice(0, 3).map((r) => (
            <a
              key={r}
              href={r}
              style={{
                fontSize: 11,
                color: 'var(--blue)',
                fontFamily: 'var(--mono)',
              }}
              target="_blank"
              rel="noreferrer"
            >
              {r.length > 70 ? r.slice(0, 67) + '...' : r}
            </a>
          ))}
        </div>
      )}
    </Card>
  )
}

const TABS = ['security', 'info', 'dependencies', 'versions'] as const
type Tab = (typeof TABS)[number]

interface ReportViewProps {
  state: ScanState
  onBack: () => void
  webllm: WebLLMState
  onRequestLoad: () => void
}

export default function ReportView({
  state,
  onBack,
  webllm,
  onRequestLoad,
}: ReportViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>('security')

  if (!state?.stats || !state?.scores) return null

  const { stats, vulns, scores, ai } = state
  // ...rest of component

  if (!stats || !scores) return null

  const { allVersions, deps, devDeps, peerDeps } = stats

  return (
    <div
      style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px 60px' }}
      className="fade-in"
    >
      {/* Back */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text3)',
          fontSize: 13,
          padding: '0 0 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        ← new search
      </button>

      {/* Hero */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <h1
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: '-.02em',
            }}
          >
            {stats.name}
          </h1>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 14,
              color: 'var(--text3)',
            }}
          >
            v{stats.latest}
          </span>
          {stats.hasTypes && (
            <span
              style={{
                fontSize: 11,
                background: 'var(--bluebg)',
                color: 'var(--bluetext)',
                borderRadius: 5,
                padding: '2px 7px',
                fontFamily: 'var(--mono)',
              }}
            >
              TS
            </span>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 14,
            flexWrap: 'wrap',
            fontSize: 13,
            color: 'var(--text2)',
            marginTop: 5,
          }}
        >
          <span>{stats.license}</span>
          {stats.maintainers.length > 0 && (
            <span>
              {stats.maintainers.length} maintainer
              {stats.maintainers.length > 1 ? 's' : ''}
            </span>
          )}
          {stats.monthsSinceUpdate !== null && (
            <span
              style={{
                color:
                  stats.monthsSinceUpdate > 24
                    ? 'var(--amber)'
                    : 'var(--text2)',
              }}
            >
              updated{' '}
              {stats.monthsSinceUpdate === 0
                ? 'this month'
                : `${stats.monthsSinceUpdate}mo ago`}
            </span>
          )}
          {stats.bundleSize && (
            <span>{fmtSize(stats.bundleSize)} unpacked</span>
          )}
        </div>
        {stats.description && (
          <p
            style={{
              fontSize: 14,
              color: 'var(--text2)',
              marginTop: 9,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            {stats.description}
          </p>
        )}
      </div>

      {/* Score chips */}
      <div
        style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}
      >
        <ScoreChip
          grade={scores.secScore}
          label="security"
          sub={`${vulns.length} vuln${vulns.length !== 1 ? 's' : ''}`}
        />
        <ScoreChip
          grade={scores.depScore}
          label="dep weight"
          sub={`${deps.length} deps`}
        />
        <ScoreChip
          grade={scores.maintScore}
          label="maintenance"
          sub={
            stats.monthsSinceUpdate !== null
              ? `${stats.monthsSinceUpdate}mo`
              : '?'
          }
        />
        <ScoreChip
          grade={scores.matScore}
          label="maturity"
          sub={`${stats.totalVersions} versions`}
        />
      </div>

      <VerdictBanner verdict={scores.verdict} />

      {/* AI analysis */}
      <AIPanel ai={ai} webllm={webllm} onRequestLoad={onRequestLoad} />

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '0.5px solid var(--border)',
          marginBottom: 16,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === tab
                  ? '2px solid var(--text)'
                  : '2px solid transparent',
              marginBottom: -0.5,
              padding: '8px 14px',
              fontSize: 12,
              fontFamily: 'var(--mono)',
              color: activeTab === tab ? 'var(--text)' : 'var(--text3)',
              cursor: 'pointer',
              transition: 'color .1s',
            }}
          >
            {tab === 'security' ? `security (${vulns.length})` : tab}
          </button>
        ))}
      </div>

      {/* Tab: Security */}
      {activeTab === 'security' && (
        <div>
          {vulns.length === 0 ? (
            <p
              style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}
            >
              No known CVEs or advisories in the OSV database.
            </p>
          ) : (
            vulns
              .slice()
              .sort(
                (a, b) =>
                  (b.severity === 'critical' ? 1 : 0) -
                  (a.severity === 'critical' ? 1 : 0),
              )
              .map((v) => <VulnCard key={v.id} vuln={v} />)
          )}
        </div>
      )}

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <Card>
          <MetaRow label="package" value={stats.name} />
          <MetaRow label="latest version" value={`v${stats.latest}`} />
          <MetaRow label="license" value={stats.license} />
          <MetaRow label="created" value={fmtDate(stats.created)} />
          <MetaRow label="last modified" value={fmtDate(stats.modified)} />
          <MetaRow label="total versions" value={fmt(stats.totalVersions)} />
          <MetaRow
            label="maintainers"
            value={stats.maintainers.join(', ') || '—'}
          />
          <MetaRow label="unpacked size" value={fmtSize(stats.bundleSize)} />
          <MetaRow label="typescript" value={stats.hasTypes ? 'yes' : 'no'} />
          {stats.engines && (
            <MetaRow
              label="engines"
              value={Object.entries(stats.engines)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')}
            />
          )}
          {stats.homepage && (
            <MetaRow
              label="homepage"
              value={
                <a href={stats.homepage} target="_blank" rel="noreferrer">
                  {stats.homepage}
                </a>
              }
            />
          )}
          {stats.repoUrl && (
            <MetaRow
              label="repository"
              value={
                <a href={stats.repoUrl} target="_blank" rel="noreferrer">
                  {stats.repoUrl}
                </a>
              }
            />
          )}
        </Card>
      )}

      {/* Tab: Dependencies */}
      {activeTab === 'dependencies' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <SectionHead>runtime deps ({deps.length})</SectionHead>
            {deps.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--greentext)' }}>
                Zero runtime dependencies — clean.
              </p>
            ) : (
              <DepGrid deps={deps} />
            )}
          </div>
          {peerDeps.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <SectionHead>peer deps ({peerDeps.length})</SectionHead>
              <DepGrid deps={peerDeps} />
            </div>
          )}
          {devDeps.length > 0 && (
            <div>
              <SectionHead>dev deps ({devDeps.length})</SectionHead>
              <DepGrid deps={devDeps} muted />
            </div>
          )}
        </div>
      )}

      {/* Tab: Versions */}
      {activeTab === 'versions' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))',
              gap: 6,
            }}
          >
            {[...allVersions]
              .reverse()
              .slice(0, 60)
              .map((v) => (
                <div
                  key={v}
                  style={{
                    background:
                      v === stats.latest ? 'var(--greenbg)' : 'var(--bg2)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    color:
                      v === stats.latest ? 'var(--greentext)' : 'var(--text2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>{v}</span>
                  {v === stats.latest && (
                    <span style={{ fontSize: 10, opacity: 0.7 }}>latest</span>
                  )}
                </div>
              ))}
          </div>
          {allVersions.length > 60 && (
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
              +{allVersions.length - 60} older versions
            </p>
          )}
        </div>
      )}
    </div>
  )
}
