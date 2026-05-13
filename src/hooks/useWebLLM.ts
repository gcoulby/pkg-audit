import { useState, useRef, useCallback, useEffect } from 'react'
import { CreateMLCEngine } from '@mlc-ai/web-llm'
import type { MLCEngine } from '@mlc-ai/web-llm'

const MODEL_ID = 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC'

export interface WebLLMState {
  status: 'idle' | 'ready' | 'loading' | 'inferring' | 'error'
  progress: number
  progressLabel: string
  error: string | null
  cached: boolean
}

export type RunInference = (
  prompt: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) => Promise<void>

export function useWebLLM() {
  const [state, setState] = useState<WebLLMState>({
    status: 'idle',
    progress: 0,
    progressLabel: '',
    error: null,
    cached: false,
  })

  const engineRef = useRef<MLCEngine | null>(null)

  useEffect(() => {
    async function checkCache() {
      if (!('caches' in window)) return
      const cached = await caches.has('webllm/model')
      if (cached) setState(s => ({ ...s, cached: true }))
    }
    checkCache()
  }, [])

  const loadModel = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading', progress: 0, progressLabel: '', error: null }))

    try {
      const engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: ({ progress, text }: { progress: number; text: string }) => {
          setState(s => ({
            ...s,
            progress: Math.round(progress * 100),
            progressLabel: text,
          }))
        },
      })
      engineRef.current = engine
      setState(s => ({ ...s, status: 'ready', progress: 100, cached: true }))
    } catch (err) {
      setState(s => ({ ...s, status: 'error', error: (err as Error).message }))
    }
  }, [])

  const runInference: RunInference = useCallback(async (prompt, onChunk, onDone, onError) => {
    const engine = engineRef.current
    if (!engine) return

    setState(s => ({ ...s, status: 'inferring' }))

    try {
      const reply = await engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 1000,
      })

      for await (const chunk of reply) {
        const text = chunk.choices[0]?.delta?.content
        if (text) onChunk(text)
      }

      setState(s => ({ ...s, status: 'ready' }))
      onDone()
    } catch (err) {
      setState(s => ({ ...s, status: 'ready' }))
      onError((err as Error).message)
    }
  }, [])

  return { state, loadModel, runInference }
}
