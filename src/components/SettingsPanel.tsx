import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Settings, ProviderName } from '../hooks/useSettings'
import { DEFAULTS } from '../hooks/useSettings'

interface SettingsPanelProps {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  onClose: () => void
}

const PROVIDERS: Array<{ id: ProviderName; label: string; sub: string }> = [
  { id: 'webllm',      label: 'WebLLM',       sub: 'Local · no key needed · WebGPU required' },
  { id: 'anthropic',   label: 'Anthropic',     sub: 'Claude · bring your own key' },
  { id: 'groq',        label: 'Groq',          sub: 'Llama / Mixtral · bring your own key' },
  { id: 'huggingface', label: 'HuggingFace',   sub: 'Inference API · bring your own key' },
  { id: 'ollama',      label: 'Ollama',        sub: 'Local server · no key needed' },
]

const ANTHROPIC_MODELS = [
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — fast, cheap' },
  { id: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 — balanced' },
  { id: 'claude-opus-4-7',           label: 'Claude Opus 4.7 — best, costly' },
]

const GROQ_MODELS = [
  { id: 'llama-3.1-70b-versatile',  label: 'Llama 3.1 70B — default' },
  { id: 'llama-3.1-8b-instant',     label: 'Llama 3.1 8B — fast' },
  { id: 'mixtral-8x7b-32768',       label: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it',             label: 'Gemma 2 9B' },
]

function KeyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'sk-...'}
        spellCheck={false}
        style={{
          width: '100%',
          padding: '9px 36px 9px 12px',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          background: 'var(--bg)',
          border: '0.5px solid var(--border2)',
          borderRadius: 7,
          color: 'var(--text)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <button
        onClick={() => setVisible(v => !v)}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: 'var(--text3)',
          cursor: 'pointer',
          fontSize: 11,
          padding: 2,
        }}
      >
        {visible ? 'hide' : 'show'}
      </button>
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      style={{
        width: '100%',
        padding: '9px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        background: 'var(--bg)',
        border: '0.5px solid var(--border2)',
        borderRadius: 7,
        color: 'var(--text)',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}

function SelectInput({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: Array<{ id: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '9px 12px',
        fontFamily: 'var(--mono)',
        fontSize: 12,
        background: 'var(--bg)',
        border: '0.5px solid var(--border2)',
        borderRadius: 7,
        color: 'var(--text)',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

function KeyLabel({ href, children }: { href: string; children: ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {children}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'var(--mono)', textDecoration: 'none' }}
      >
        get key ↗
      </a>
    </span>
  )
}

function Field({ label, children }: { label: ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10,
        fontFamily: 'var(--mono)',
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        color: 'var(--text3)',
        marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function ProviderConfig({ settings, onUpdate }: { settings: Settings; onUpdate: (p: Partial<Settings>) => void }) {
  switch (settings.provider) {
    case 'webllm':
      return (
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7 }}>
          <div>Model: Qwen2.5-Coder 7B (~4.5 GB)</div>
          <div>Runs entirely in your browser via WebGPU.</div>
          <div>No API key or internet connection needed after first download.</div>
          <div style={{ marginTop: 10, color: 'var(--text3)', fontSize: 11 }}>Requires Chrome 113+ or Edge 113+</div>
        </div>
      )

    case 'anthropic':
      return (
        <>
          <Field label={<KeyLabel href="https://console.anthropic.com/account/keys">API key</KeyLabel>}>
            <KeyInput
              value={settings.anthropicKey}
              onChange={v => onUpdate({ anthropicKey: v })}
              placeholder="sk-ant-..."
            />
          </Field>
          <Field label="Model">
            <SelectInput
              value={settings.anthropicModel}
              onChange={v => onUpdate({ anthropicModel: v })}
              options={ANTHROPIC_MODELS}
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Keys are stored in your browser's localStorage and never leave your device.
          </div>
        </>
      )

    case 'groq':
      return (
        <>
          <Field label={<KeyLabel href="https://console.groq.com/keys">API key</KeyLabel>}>
            <KeyInput
              value={settings.groqKey}
              onChange={v => onUpdate({ groqKey: v })}
              placeholder="gsk_..."
            />
          </Field>
          <Field label="Model">
            <SelectInput
              value={settings.groqModel}
              onChange={v => onUpdate({ groqModel: v })}
              options={GROQ_MODELS}
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Keys are stored in your browser's localStorage and never leave your device.
          </div>
        </>
      )

    case 'huggingface':
      return (
        <>
          <Field label={<KeyLabel href="https://huggingface.co/settings/tokens">API key</KeyLabel>}>
            <KeyInput
              value={settings.hfKey}
              onChange={v => onUpdate({ hfKey: v })}
              placeholder="hf_..."
            />
          </Field>
          <Field label="Model ID">
            <TextInput
              value={settings.hfModel}
              onChange={v => onUpdate({ hfModel: v })}
              placeholder="mistralai/Mistral-7B-Instruct-v0.3"
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Any model on the HuggingFace Inference API that supports chat completions.
            Keys are stored in localStorage only.
          </div>
        </>
      )

    case 'ollama':
      return (
        <>
          <Field label="Host">
            <TextInput
              value={settings.ollamaHost}
              onChange={v => onUpdate({ ollamaHost: v })}
              placeholder={DEFAULTS.ollamaHost}
            />
          </Field>
          <Field label="Model">
            <TextInput
              value={settings.ollamaModel}
              onChange={v => onUpdate({ ollamaModel: v })}
              placeholder={DEFAULTS.ollamaModel}
            />
          </Field>
          <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6 }}>
            Ollama must be running locally with CORS enabled:
            <br />
            <span style={{ fontFamily: 'var(--mono)' }}>OLLAMA_ORIGINS=* ollama serve</span>
          </div>
        </>
      )
  }
}

export default function SettingsPanel({ settings, onUpdate, onClose }: SettingsPanelProps) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }}
      />

      {/* panel */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: 'var(--bg)',
        borderLeft: '0.5px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '0.5px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>AI provider</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {/* provider list */}
          <div style={{ marginBottom: 20 }}>
            {PROVIDERS.map(p => {
              const active = settings.provider === p.id
              return (
                <div
                  key={p.id}
                  onClick={() => onUpdate({ provider: p.id })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 4,
                    cursor: 'pointer',
                    background: active ? 'var(--bg2)' : 'transparent',
                    border: active ? '0.5px solid var(--border2)' : '0.5px solid transparent',
                  }}
                >
                  <div style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: active ? 'var(--text)' : 'var(--border2)',
                    flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 13, color: active ? 'var(--text)' : 'var(--text2)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{p.sub}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* divider */}
          <div style={{ borderTop: '0.5px solid var(--border)', marginBottom: 20 }} />

          {/* per-provider config */}
          <ProviderConfig settings={settings} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  )
}
