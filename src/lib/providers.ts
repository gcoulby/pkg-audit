import type { Settings } from '../hooks/useSettings'
import type { RunInference } from '../hooks/useWebLLM'

// --- SSE line reader ---

async function* sseLines(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) yield line
  }
}

// --- Provider implementations ---

async function streamAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
  onChunk: (c: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // required to allow direct browser calls without a proxy
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    onError(err.error?.message || `Anthropic error ${res.status}`)
    return
  }

  for await (const line of sseLines(res)) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') break
    try {
      const j = JSON.parse(payload) as { delta?: { text?: string } }
      if (j.delta?.text) onChunk(j.delta.text)
    } catch { /* ignore malformed */ }
  }
  onDone()
}

async function streamOpenAICompat(
  prompt: string,
  url: string,
  apiKey: string,
  model: string,
  onChunk: (c: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } | string }
    const msg = typeof err.error === 'string' ? err.error : err.error?.message
    onError(msg || `Provider error ${res.status}`)
    return
  }

  for await (const line of sseLines(res)) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') break
    try {
      const j = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
      const text = j.choices?.[0]?.delta?.content
      if (text) onChunk(text)
    } catch { /* ignore malformed */ }
  }
  onDone()
}

async function streamOllama(
  prompt: string,
  host: string,
  model: string,
  onChunk: (c: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    onError(`Ollama error ${res.status} — is it running at ${host}?`)
    return
  }

  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const j = JSON.parse(line) as { message?: { content?: string } }
        if (j.message?.content) onChunk(j.message.content)
      } catch { /* ignore */ }
    }
  }
  onDone()
}

// --- Public: build a RunInference-compatible function for online providers ---

export function makeProviderRunner(settings: Settings): RunInference {
  return async (prompt, onChunk, onDone, onError) => {
    try {
      switch (settings.provider) {
        case 'anthropic':
          if (!settings.anthropicKey) {
            onError('No Anthropic API key — open ⚙ Settings to add one')
            return
          }
          await streamAnthropic(prompt, settings.anthropicKey, settings.anthropicModel, onChunk, onDone, onError)
          break

        case 'groq':
          if (!settings.groqKey) {
            onError('No Groq API key — open ⚙ Settings to add one')
            return
          }
          await streamOpenAICompat(
            prompt,
            'https://api.groq.com/openai/v1/chat/completions',
            settings.groqKey,
            settings.groqModel,
            onChunk, onDone, onError,
          )
          break

        case 'huggingface':
          if (!settings.hfKey) {
            onError('No HuggingFace API key — open ⚙ Settings to add one')
            return
          }
          await streamOpenAICompat(
            prompt,
            `https://api-inference.huggingface.co/models/${settings.hfModel}/v1/chat/completions`,
            settings.hfKey,
            settings.hfModel,
            onChunk, onDone, onError,
          )
          break

        case 'ollama':
          await streamOllama(
            prompt,
            settings.ollamaHost || 'http://localhost:11434',
            settings.ollamaModel,
            onChunk, onDone, onError,
          )
          break

        default:
          break
      }
    } catch (err) {
      onError((err as Error).message)
    }
  }
}
