import { useState, useCallback } from 'react'

export type ProviderName = 'webllm' | 'anthropic' | 'groq' | 'huggingface' | 'ollama'

export interface Settings {
  provider: ProviderName
  anthropicKey: string
  anthropicModel: string
  groqKey: string
  groqModel: string
  hfKey: string
  hfModel: string
  ollamaHost: string
  ollamaModel: string
}

export const DEFAULTS: Settings = {
  provider: 'webllm',
  anthropicKey: '',
  anthropicModel: 'claude-haiku-4-5-20251001',
  groqKey: '',
  groqModel: 'llama-3.1-70b-versatile',
  hfKey: '',
  hfModel: 'mistralai/Mistral-7B-Instruct-v0.3',
  ollamaHost: 'http://localhost:11434',
  ollamaModel: 'qwen2.5-coder:7b',
}

const STORAGE_KEY = 'pkgaudit_settings'

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<Settings> }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { settings, updateSettings }
}
