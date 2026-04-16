const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());

// Allow CORS so pages opened via file:// (origin null) can call the proxy
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Explicit OPTIONS handler to ensure CORS headers are present for preflight
// Preflight handler for the generate endpoint (avoid wildcard parsing issues)
app.options('/api/generate', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.status(200).end();
});

const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.MODEL || 'llama3:latest';

// Serve static files from current directory (public)
app.use(express.static(path.join(__dirname, '.')));

app.post('/api/generate', async (req, res) => {
  try {
    // Ensure CORS headers are present on the streamed response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

    const prompt = (req.body && (req.body.message || req.body.prompt)) || '';
    const payload = JSON.stringify({ model: MODEL, prompt, max_tokens: 512 });

    const fetchRes = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (!fetchRes.ok) {
      const txt = await fetchRes.text().catch(() => '');
      res.status(502).json({ error: 'Bad gateway', details: txt });
      return;
    }

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = fetchRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/health', async (req, res) => {
  try {
    // Health endpoint should also expose CORS for file:// clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    const r = await fetch(`${OLLAMA_HOST}/`);
    const txt = await r.text().catch(() => '');
    res.json({ ok: txt && txt.includes('Ollama') });
  } catch (err) {
    res.json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
