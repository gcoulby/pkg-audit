import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001
const isProd = process.env.NODE_ENV === 'production'
console.log(process.env.AI_MODEL)
// --- Provider config ---
// Set AI_PROVIDER in .env: anthropic | groq | huggingface | ollama
// Auto-detected from which key is present if not set explicitly.
const PROVIDER =
  process.env.AI_PROVIDER ||
  (process.env.ANTHROPIC_API_KEY
    ? 'anthropic'
    : process.env.GROQ_API_KEY
      ? 'groq'
      : process.env.HF_API_KEY
        ? 'huggingface'
        : 'ollama')

const PROVIDERS = {
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    model: process.env.AI_MODEL || 'claude-sonnet-4-20250514',
    key: process.env.ANTHROPIC_API_KEY,
  },
  groq: {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: process.env.AI_MODEL || 'llama-3.1-70b-versatile',
    key: process.env.GROQ_API_KEY,
  },
  huggingface: {
    url:
      'https://api-inference.huggingface.co/models/' +
      (process.env.AI_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3') +
      '/v1/chat/completions',
    model: process.env.AI_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3',
    key: process.env.HF_API_KEY,
  },
  ollama: {
    url: (process.env.OLLAMA_HOST || 'http://localhost:11434') + '/api/chat',
    model: process.env.AI_MODEL || 'qwen2.5-coder:7b',
    key: null,
  },
}

// --- Middleware ---
app.use(express.json())
app.use(cors({ origin: isProd ? false : 'http://localhost:5173' }))

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 20 : 100,
  message: { error: 'Too many requests, slow down.' },
})

// --- Prompt (same regardless of provider) ---
function buildPrompt(pkg) {
  const {
    name,
    version,
    description,
    license,
    maintainers,
    totalVersions,
    deps,
    vulns,
  } = pkg
  const vulnLines =
    vulns.length === 0
      ? 'No known vulnerabilities.'
      : vulns
          .slice(0, 8)
          .map(
            (v) =>
              '- ' +
              v.id +
              ' (' +
              (v.severity || '?') +
              '): ' +
              (v.summary || 'no summary'),
          )
          .join('\n')

  return (
    'You are a blunt, expert Node.js security reviewer. A developer is deciding whether to add this npm package.\n\n' +
    'Package: ' +
    name +
    '\n' +
    'Version: ' +
    version +
    '\n' +
    'Description: ' +
    (description || 'none') +
    '\n' +
    'License: ' +
    (license || 'unknown') +
    '\n' +
    'Maintainers: ' +
    (maintainers || 'unknown') +
    '\n' +
    'Total published versions: ' +
    totalVersions +
    '\n' +
    'Runtime dependencies (' +
    deps.count +
    '): ' +
    deps.list +
    '\n' +
    'Known vulnerabilities:\n' +
    vulnLines +
    '\n\n' +
    'Write a concise audit with exactly these 4 section headers on their own line, nothing before the first header:\n\n' +
    'SECURITY\n' +
    'Assess the CVE situation. Are the vulns patched in newer versions? Is the advisory history concerning or routine?\n\n' +
    'DEPENDENCY WEIGHT\n' +
    'How heavy is this package? Does it pull in a lot of transitive deps? Is the dep tree appropriate for what it does?\n\n' +
    'DO YOU EVEN NEED THIS\n' +
    "This is the most important section. Be ruthless. Could a developer replace this with 5-10 lines of native JS or built-in Node APIs? If yes, say exactly what they'd write instead. Only credit the package if it genuinely handles complex edge cases, browser compatibility nightmares, or encoding/parsing logic that's genuinely hard to get right. Call out lazy installs directly.\n\n" +
    "Do not hedge. Do not say 'you might consider'. Do not give the package the benefit of the doubt. If it can be replaced with one line of JS, say so explicitly and write that line." +
    'When libraries are large such as react or vue they do a lot of heavy lifting, when they are small - they cost a dependency and it may just be out of laziness' +
    'VERDICT\n' +
    'One clear recommendation: use it / avoid it / use it with conditions. State the version to pin to if applicable.\n\n' +
    'Be specific and direct. No filler. Under 380 words total.'
  )
}

// --- SSE line reader (shared by Anthropic + OpenAI-compat providers) ---
async function* sseLines(response) {
  const reader = response.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) yield line
  }
}

// --- Provider stream adapters ---

async function streamAnthropic(prompt, cfg, res) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) throw new Error('Anthropic ' + r.status + ': ' + (await r.text()))

  for await (const line of sseLines(r)) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') break
    try {
      const j = JSON.parse(payload)
      const text = j.delta?.text
      if (text) res.write('data: ' + JSON.stringify({ text }) + '\n\n')
    } catch {}
  }
}

// OpenAI-compatible: Groq, HuggingFace, any future provider
async function streamOpenAICompat(prompt, cfg, res) {
  const headers = { 'Content-Type': 'application/json' }
  if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key

  const r = await fetch(cfg.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1000,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok)
    throw new Error(PROVIDER + ' ' + r.status + ': ' + (await r.text()))

  for await (const line of sseLines(r)) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') break
    try {
      const j = JSON.parse(payload)
      const text = j.choices?.[0]?.delta?.content
      if (text) res.write('data: ' + JSON.stringify({ text }) + '\n\n')
    } catch {}
  }
}

// Ollama streams newline-delimited JSON, not SSE
async function streamOllama(prompt, cfg, res) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) throw new Error('Ollama ' + r.status + ': ' + (await r.text()))

  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const j = JSON.parse(line)
        const text = j.message?.content
        if (text) res.write('data: ' + JSON.stringify({ text }) + '\n\n')
      } catch {}
    }
  }
}

// --- Route: stream AI analysis ---
app.post('/api/analyse', aiLimiter, async (req, res) => {
  const { pkg } = req.body
  if (!pkg?.name) return res.status(400).json({ error: 'Missing pkg.name' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const cfg = PROVIDERS[PROVIDER]
  const prompt = buildPrompt(pkg)

  try {
    if (PROVIDER === 'anthropic') await streamAnthropic(prompt, cfg, res)
    else if (PROVIDER === 'ollama') await streamOllama(prompt, cfg, res)
    else await streamOpenAICompat(prompt, cfg, res)

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[analyse:' + PROVIDER + ']', err.message)
    res.write('data: ' + JSON.stringify({ error: err.message }) + '\n\n')
    res.end()
  }
})

// --- Route: batch OSV query (lockfile mode) ---
app.post('/api/osv/batch', aiLimiter, async (req, res) => {
  const { packages } = req.body
  if (!Array.isArray(packages))
    return res.status(400).json({ error: 'packages must be an array' })

  try {
    const queries = packages.slice(0, 50).map(({ name, version }) => ({
      package: { name, ecosystem: 'npm' },
      ...(version ? { version } : {}),
    }))
    const r = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    })
    res.json(await r.json())
  } catch (err) {
    console.error('[osv/batch]', err.message)
    res.status(502).json({ error: 'OSV query failed' })
  }
})

// --- Serve built frontend in production ---
if (isProd) {
  const distPath = join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (_, res) => res.sendFile(join(distPath, 'index.html')))
}

app.listen(PORT, () => {
  console.log(
    '[pkg-audit] server on http://localhost:' +
      PORT +
      ' (provider: ' +
      PROVIDER +
      ', model: ' +
      PROVIDERS[PROVIDER].model +
      ')',
  )
  if (PROVIDER !== 'ollama' && !PROVIDERS[PROVIDER].key) {
    console.warn(
      '[pkg-audit] WARNING: no API key set for provider "' + PROVIDER + '"',
    )
  }
})
