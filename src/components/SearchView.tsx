import { useState, useRef, useEffect } from 'react'
import { fetchNpmSearch } from '../lib/api'
import type { NpmSearchItem } from '../lib/api'
import type { WebLLMState } from '../hooks/useWebLLM'
import type { ProviderName } from '../hooks/useSettings'

interface SearchViewProps {
  onSearch: (query: string) => void
  getRecent: () => string[]
  webllm: WebLLMState
  onRequestLoad: () => void
  provider: ProviderName
}

export default function SearchView({ onSearch, getRecent, webllm, onRequestLoad, provider }: SearchViewProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<NpmSearchItem[]>([])
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recent = getRecent()

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      const results = await fetchNpmSearch(value)
      setSuggestions(results)
    }, 250)
  }

  function submit(name: string) {
    if (!name.trim()) return
    setSuggestions([])
    onSearch(name.trim())
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '0 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--mono)',
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-.02em',
            color: 'var(--text)',
          }}>
            pkg-audit
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>
            npm package security &amp; quality audit
          </p>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(query) }}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="package name"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontFamily: 'var(--mono)',
              fontSize: 15,
              background: 'var(--bg2)',
              border: '0.5px solid var(--border2)',
              borderRadius: 10,
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {focused && suggestions.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--bg2)',
              border: '0.5px solid var(--border)',
              borderRadius: 10,
              overflow: 'hidden',
              zIndex: 10,
            }}>
              {suggestions.map(s => (
                <div
                  key={s.name}
                  onMouseDown={() => submit(s.name)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderBottom: '0.5px solid var(--border)',
                  }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>
                    {s.name}
                  </div>
                  {s.description && (
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text3)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {s.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {recent.length > 0 && !focused && (
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontSize: 10,
              color: 'var(--text3)',
              fontFamily: 'var(--mono)',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              recent
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recent.slice(0, 8).map(name => (
                <button
                  key={name}
                  onClick={() => submit(name)}
                  style={{
                    background: 'var(--bg2)',
                    border: '0.5px solid var(--border)',
                    borderRadius: 6,
                    padding: '5px 10px',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {provider === 'webllm' && <ModelWidget webllm={webllm} onRequestLoad={onRequestLoad} />}
      </div>
    </div>
  )
}

function ModelWidget({ webllm, onRequestLoad }: { webllm: WebLLMState; onRequestLoad: () => void }) {
  const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu

  const wrap: React.CSSProperties = {
    marginTop: 28,
    padding: '12px 14px',
    background: 'var(--bg2)',
    borderRadius: 10,
    border: '0.5px solid var(--border)',
  }

  if (!hasWebGPU) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
          AI analysis requires WebGPU (Chrome 113+, Edge 113+)
        </div>
      </div>
    )
  }

  if (webllm.status === 'ready' || webllm.status === 'inferring') {
    return (
      <div style={{ ...wrap, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--greentext)', fontFamily: 'var(--mono)' }}>●</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>AI model ready</span>
      </div>
    )
  }

  if (webllm.status === 'loading') {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
          Loading model — {webllm.progress}%
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 4, height: 4, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{
            height: '100%',
            width: `${webllm.progress}%`,
            background: 'var(--text3)',
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {webllm.progressLabel}
        </div>
      </div>
    )
  }

  if (webllm.status === 'error') {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 11, color: 'var(--redtext)' }}>{webllm.error || 'Model failed to load'}</div>
      </div>
    )
  }

  // idle
  if (webllm.cached) {
    return (
      <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>AI model cached</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Load for in-browser analysis</div>
        </div>
        <button
          onClick={onRequestLoad}
          style={{
            background: 'var(--bg)',
            border: '0.5px solid var(--border2)',
            borderRadius: 7,
            padding: '6px 12px',
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
    )
  }

  return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>AI analysis — runs locally</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Qwen2.5-Coder 7B · ~4.5 GB · one-time download · WebGPU</div>
      </div>
      <button
        onClick={onRequestLoad}
        style={{
          background: 'var(--bg)',
          border: '0.5px solid var(--border2)',
          borderRadius: 7,
          padding: '6px 12px',
          fontSize: 12,
          color: 'var(--text)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      >
        Download
      </button>
    </div>
  )
}
