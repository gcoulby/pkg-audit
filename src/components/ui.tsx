import type { CSSProperties, ReactNode } from 'react'
import type { Scores } from '../lib/api'

export function Badge({ sev }: { sev?: string }) {
  const s = (sev || '').toLowerCase()
  const map: Record<string, { bg: string; color: string }> = {
    critical: { bg: 'var(--redbg)', color: 'var(--redtext)' },
    high: { bg: 'var(--amberbg)', color: 'var(--ambertext)' },
    moderate: { bg: 'var(--bluebg)', color: 'var(--bluetext)' },
    medium: { bg: 'var(--bluebg)', color: 'var(--bluetext)' },
    low: { bg: 'var(--bg3)', color: 'var(--text2)' },
    unknown: { bg: 'var(--bg3)', color: 'var(--text3)' },
  }
  const { bg, color } = map[s] ?? map['unknown']
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 5,
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'var(--mono)',
        background: bg,
        color,
      }}
    >
      {s || 'unknown'}
    </span>
  )
}

const GRADE_STYLES: Record<string, CSSProperties> = {
  A: { color: 'var(--green)' },
  B: { color: 'var(--green)' },
  C: { color: 'var(--amber)' },
  D: { color: 'var(--red)' },
  F: { color: 'var(--red)' },
}

export function ScoreChip({
  grade,
  label,
  sub,
}: {
  grade: string
  label: string
  sub?: string | number
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--bg2)',
        borderRadius: 10,
        padding: '12px 16px',
        flex: 1,
        minWidth: 72,
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 24,
          fontWeight: 500,
          fontFamily: 'var(--mono)',
          ...(GRADE_STYLES[grade] || {}),
        }}
      >
        {grade}
      </span>
      <span
        style={{
          fontSize: 10,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
        }}
      >
        {label}
      </span>
      {sub !== undefined && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
          }}
        >
          {sub}
        </span>
      )}
    </div>
  )
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '1.5px solid var(--border2)',
        borderTopColor: 'var(--text2)',
        borderRadius: '50%',
        animation: 'spin .7s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

export function DotPulse() {
  return (
    <span style={{ display: 'flex', gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--text3)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

export function SectionHead({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '.1em',
        color: 'var(--text3)',
        fontFamily: 'var(--mono)',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      {children}
    </div>
  )
}

export function Card({
  children,
  style,
  onClick,
}: {
  children: ReactNode
  style?: CSSProperties
  onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg)',
        border: '0.5px solid var(--border)',
        borderRadius: 12,
        padding: '14px 16px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        fontSize: 13,
        padding: '6px 0',
        borderBottom: '0.5px solid var(--border)',
      }}
    >
      <span style={{ color: 'var(--text2)', flexShrink: 0, minWidth: 130 }}>
        {label}
      </span>
      <span
        style={{
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          textAlign: 'right',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  )
}

export function VerdictBanner({
  verdict,
  text: overrideText,
}: {
  verdict: Scores['verdict']
  text?: string
}) {
  const map: Record<
    Scores['verdict'],
    { bg: string; color: string; icon: string; text: string }
  > = {
    pass: {
      bg: 'var(--greenbg)',
      color: 'var(--greentext)',
      icon: '✓',
      text: 'approved — no blocking vulnerabilities',
    },
    warn: {
      bg: 'var(--amberbg)',
      color: 'var(--ambertext)',
      icon: '⚠',
      text: 'caution — high severity issues found',
    },
    block: {
      bg: 'var(--redbg)',
      color: 'var(--redtext)',
      icon: '✕',
      text: 'blocked — critical vulnerabilities present',
    },
  }
  const { bg, color, icon, text } = map[verdict]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '11px 14px',
        borderRadius: 10,
        background: bg,
        color,
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 20,
      }}
    >
      <span>{icon}</span>
      <span>{overrideText ?? text}</span>
    </div>
  )
}
