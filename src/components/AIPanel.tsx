import { DotPulse } from './ui'
import type { AiState } from '../hooks/usePackageScan'
import type { WebLLMState } from '../hooks/useWebLLM'
import type { ProviderName } from '../hooks/useSettings'

const SECTION_HEADERS = ['SECURITY', 'DEPENDENCY WEIGHT', 'DO YOU EVEN NEED THIS', 'VERDICT']

type Part = { type: 'text'; content: string } | { type: 'header'; label: string }

function formatAIText(text: string): Part[] {
  let parts: Part[] = [{ type: 'text', content: text }]

  for (const header of SECTION_HEADERS) {
    parts = parts.flatMap(part => {
      if (part.type !== 'text') return [part]

      const startIdx = part.content.startsWith(header) ? 0 : -1
      const idx = part.content.indexOf('\n' + header + '\n')

      if (startIdx === 0) {
        const rest = part.content.slice(header.length).trimStart()
        const nextHeader = SECTION_HEADERS.find(h => h !== header && rest.includes('\n' + h + '\n'))
        if (!nextHeader) return [{ type: 'header', label: header }, { type: 'text', content: rest }]
        const split = rest.indexOf('\n' + nextHeader + '\n')
        return [
          { type: 'header', label: header },
          { type: 'text', content: rest.slice(0, split) },
          { type: 'text', content: rest.slice(split) },
        ]
      }

      if (idx === -1) return [part]
      return [
        { type: 'text', content: part.content.slice(0, idx) },
        { type: 'header', label: header },
        { type: 'text', content: part.content.slice(idx + header.length + 2) },
      ]
    })
  }

  return parts
}

const headerStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  fontFamily: 'var(--mono)',
  marginTop: 16,
  marginBottom: 4,
}

const textStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text2)',
  lineHeight: 1.75,
  whiteSpace: 'pre-wrap',
}

const panelWrap: React.CSSProperties = {
  background: 'var(--bg2)',
  borderRadius: 12,
  padding: 16,
  marginBottom: 24,
}

function StreamedContent({ text, streaming }: { text: string; streaming: boolean }) {
  const parts = formatAIText(text)
  return (
    <div>
      {parts.map((part, i) => {
        if (part.type === 'header') {
          return (
            <span key={i} style={{
              ...headerStyle,
              marginTop: i === 0 ? 0 : 16,
              color: part.label === 'VERDICT' ? 'var(--text2)' : 'var(--text3)',
              fontWeight: part.label === 'VERDICT' ? 500 : 400,
            }}>
              {part.label}
            </span>
          )
        }
        return (
          <span key={i} style={{ ...textStyle, display: 'block' }}>
            {part.content.trim()}
          </span>
        )
      })}
      {streaming && (
        <span style={{
          display: 'inline-block',
          width: 2,
          height: 13,
          background: 'var(--text3)',
          marginLeft: 2,
          verticalAlign: 'middle',
          animation: 'pulse 1s ease-in-out infinite',
        }} />
      )}
    </div>
  )
}

interface AIPanelProps {
  ai: AiState
  webllm: WebLLMState
  onRequestLoad: () => void
  provider: ProviderName
}

export default function AIPanel({ ai, webllm, onRequestLoad, provider }: AIPanelProps) {
  // Online providers — skip WebLLM lifecycle UI entirely
  if (provider !== 'webllm') {
    const { text, status } = ai
    if (status === 'idle') return null
    return (
      <div style={panelWrap}>
        {status === 'streaming' && !text && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 13 }}>
            <DotPulse />
            <span>analysing...</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{ fontSize: 13, color: 'var(--redtext)' }}>{ai.error}</div>
        )}
        {text && <StreamedContent text={text} streaming={status === 'streaming'} />}
      </div>
    )
  }

  // WebLLM: WebGPU check
  const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu

  if (!hasWebGPU) {
    return (
      <div style={panelWrap}>
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.7 }}>
          <div style={{ fontFamily: 'var(--mono)', marginBottom: 4 }}>AI analysis requires WebGPU</div>
          <div style={{ fontSize: 12 }}>Supported in Chrome 113+ and Edge 113+</div>
          <div style={{ fontSize: 12 }}>Firefox and Safari not yet supported</div>
        </div>
      </div>
    )
  }

  // WebLLM: idle — download or cached prompt
  if (webllm.status === 'idle') {
    if (webllm.cached) {
      return (
        <div style={panelWrap}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>✓ Model cached</div>
            </div>
            <button
              onClick={onRequestLoad}
              style={{
                background: 'var(--bg)',
                border: '0.5px solid var(--border2)',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                color: 'var(--text)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
                flexShrink: 0,
              }}
            >
              Load (~2s)
            </button>
          </div>
        </div>
      )
    }

    return (
      <div style={panelWrap}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>↓</span>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>Run analysis locally in your browser</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
            <div>Qwen2.5-Coder 7B · ~4.5 GB · one-time download</div>
            <div>Cached after first use — no re-download on future visits</div>
            <div>Requires WebGPU (Chrome 113+, Edge)</div>
          </div>
          <button
            onClick={onRequestLoad}
            style={{
              alignSelf: 'flex-start',
              background: 'var(--bg)',
              border: '0.5px solid var(--border2)',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            Download and run locally
          </button>
        </div>
      </div>
    )
  }

  // WebLLM: loading
  if (webllm.status === 'loading') {
    return (
      <div style={panelWrap}>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
          Loading model
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%',
            width: `${webllm.progress}%`,
            background: 'var(--text3)',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
          <span style={{ fontFamily: 'var(--mono)' }}>{webllm.progressLabel}</span>
          <span>{webllm.progress}%</span>
        </div>
      </div>
    )
  }

  // WebLLM: model load error
  if (webllm.status === 'error') {
    return (
      <div style={panelWrap}>
        <div style={{ fontSize: 13, color: 'var(--redtext)' }}>
          {webllm.error || 'Model failed to load'}
        </div>
      </div>
    )
  }

  // WebLLM: ready or inferring — show AI output
  const { text, status } = ai

  return (
    <div style={panelWrap}>
      {(status === 'streaming' || webllm.status === 'inferring') && !text && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text3)', fontSize: 13 }}>
          <DotPulse />
          <span>analysing...</span>
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: 13, color: 'var(--redtext)' }}>
          {ai.error || 'Analysis failed'}
        </div>
      )}
      {text && (
        <StreamedContent
          text={text}
          streaming={status === 'streaming' || webllm.status === 'inferring'}
        />
      )}
    </div>
  )
}
