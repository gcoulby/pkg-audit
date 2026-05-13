import { useWebLLM } from './hooks/useWebLLM'
import { usePackageScan } from './hooks/usePackageScan'
import SearchView from './components/SearchView'
import ReportView from './components/ReportView'
import { Spinner } from './components/ui'

export default function App() {
  const { state: webllm, loadModel, runInference } = useWebLLM()
  const { state, scan, reset, getRecent } = usePackageScan(runInference)

  return (
    <>
      {state.phase === 'search' && (
        <SearchView onSearch={scan} getRecent={getRecent} webllm={webllm} onRequestLoad={loadModel} />
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
        <ReportView state={state} onBack={reset} webllm={webllm} onRequestLoad={loadModel} />
      )}
    </>
  )
}
