import { useState, useCallback } from 'react'
import { useWebLLM } from './hooks/useWebLLM'
import { usePackageScan } from './hooks/usePackageScan'
import { useSettings } from './hooks/useSettings'
import { makeProviderRunner } from './lib/providers'
import type { RunInference } from './hooks/useWebLLM'
import SearchView from './components/SearchView'
import ReportView from './components/ReportView'
import SettingsPanel from './components/SettingsPanel'
import { Spinner } from './components/ui'

export default function App() {
  const { settings, updateSettings } = useSettings()
  const { state: webllm, loadModel, runInference } = useWebLLM()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const runAI: RunInference = useCallback(async (prompt, onChunk, onDone, onError) => {
    if (settings.provider === 'webllm') {
      return runInference(prompt, onChunk, onDone, onError)
    }
    return makeProviderRunner(settings)(prompt, onChunk, onDone, onError)
  }, [settings, runInference])

  const { state, scan, reset, getRecent } = usePackageScan(runAI)

  return (
    <>
      {/* always-visible settings button */}
      <button
        onClick={() => setSettingsOpen(true)}
        title="AI provider settings"
        style={{
          position: 'fixed',
          top: 14,
          right: 16,
          zIndex: 100,
          background: 'none',
          border: 'none',
          color: 'var(--text3)',
          fontSize: 16,
          cursor: 'pointer',
          padding: 4,
          lineHeight: 1,
        }}
      >
        ⚙
      </button>

      {state.phase === 'search' && (
        <SearchView
          onSearch={scan}
          getRecent={getRecent}
          webllm={webllm}
          onRequestLoad={loadModel}
          provider={settings.provider}
        />
      )}

      {state.phase === 'loading' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 12,
          color: 'var(--text3)',
          fontSize: 14,
          fontFamily: 'var(--mono)',
        }}>
          <Spinner size={16} />
          scanning {state.query}...
        </div>
      )}

      {state.phase === 'error' && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 14,
        }}>
          <div style={{ fontSize: 13, color: 'var(--redtext)', background: 'var(--redbg)', borderRadius: 8, padding: '10px 16px' }}>
            {state.error}
          </div>
          <button
            onClick={reset}
            style={{ background: 'none', border: '0.5px solid var(--border2)', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: 'var(--text2)' }}
          >
            try again
          </button>
        </div>
      )}

      {state.phase === 'report' && (
        <ReportView
          state={state}
          onBack={reset}
          webllm={webllm}
          onRequestLoad={loadModel}
          provider={settings.provider}
        />
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          onUpdate={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  )
}
