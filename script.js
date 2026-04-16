// Determine BASE_URL from saved setting or fallback. If opened via file://, default to localhost proxy.
function getSavedEndpoint() {
  try {
    return (localStorage.getItem('ollama_endpoint') || '').trim();
  } catch (e) {
    return '';
  }
}

let BASE_URL = '';
if (typeof location !== 'undefined' && location.protocol === 'file:') {
  BASE_URL = getSavedEndpoint() || 'http://127.0.0.1:3000';
} else {
  BASE_URL = getSavedEndpoint() || '';
}

// If this site is served from the GitHub Pages URL for this repo and
// no endpoint is saved, default to the current public tunnel so the
// published site works without manual settings (ephemeral URL).
try {
  // If no saved endpoint and this page is served from GitHub Pages (or any github.io host),
  // try to fetch a published `/endpoint.json` file from the site root. That file should
  // contain { "endpoint": "https://your-tunnel.loca.lt" } and allows the published
  // site to pick up the current public tunnel URL without hardcoding it here.
  if (!getSavedEndpoint() && typeof location !== 'undefined' && (location.hostname === 'okayowhy.github.io' || location.hostname.endsWith('.github.io'))) {
    (async () => {
      try {
        const res = await fetch('/endpoint.json', { cache: 'no-cache' });
        if (res.ok) {
          const obj = await res.json().catch(() => null);
          if (obj && obj.endpoint) {
            const ep = (obj.endpoint || '').trim();
            if (ep) {
              try { localStorage.setItem('ollama_endpoint', ep); } catch (e) {}
              BASE_URL = ep;
            }
          }
        }
      } catch (e) {
        // ignore — we'll fall back to saved endpoint or empty
      }
    })();
  }
} catch (e) {}
const heroEl = document.getElementById('hero');
const chatEl = document.getElementById('chat');
const whyButton = document.getElementById('why-button');
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');

let isThinking = false;
let waitingResponse = false;

function renderMarkdown(md) {
  try {
    const html = marked.parse(md || '');
    return DOMPurify.sanitize(html);
  } catch (error) {
    return String(md);
  }
}

function appendMessage(message) {
  const el = document.createElement('div');
  el.className = `message ${message.role === 'user' ? 'user' : ''}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = renderMarkdown(message.content);
  el.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = new Date().toLocaleTimeString();
  el.appendChild(meta);

  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setThinking(state) {
  isThinking = state;
  if (state) {
    const thinker = document.createElement('div');
    thinker.id = 'thinking-indicator';
    thinker.className = 'message';
    thinker.innerHTML = `<div class="bubble" style="color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05);">thinking<span class="animate-pulse">...</span></div>`;
    messagesEl.appendChild(thinker);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    const thinker = document.getElementById('thinking-indicator');
    if (thinker) thinker.remove();
  }
}

function showChat() {
  heroEl.classList.add('hidden');
  chatEl.classList.remove('hidden');
  setTimeout(() => {
    appendMessage({ role: 'user', content: 'why?' });
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      appendMessage({ role: 'system', content: 'because you asked.' });
    }, 2000);
  }, 100);
}

function showHero() {
  chatEl.classList.add('hidden');
  heroEl.classList.remove('hidden');
}

async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text || waitingResponse) return;

  appendMessage({ role: 'user', content: text });
  inputEl.value = '';
  inputEl.focus();

  setThinking(true);
  waitingResponse = true;
  const placeholder = document.getElementById('thinking-indicator');
  const bubbleEl = placeholder ? placeholder.querySelector('.bubble') : null;

  try {
    const endpoint = BASE_URL ? `${BASE_URL}/api/generate` : '/api/generate';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });

    if (!resp.ok) {
      const textErr = await resp.text().catch(() => null);
      if (bubbleEl) bubbleEl.textContent = 'Error: ' + (textErr || resp.statusText);
      return;
    }

    // Stream and parse NDJSON
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.response) {
            reply += obj.response;
            if (bubbleEl) bubbleEl.innerHTML = renderMarkdown(reply);
          }
        } catch (err) {
          // ignore malformed chunks
        }
      }
    }

    if (buffer.trim()) {
      try {
        const obj = JSON.parse(buffer);
        if (obj.response) reply += obj.response;
      } catch (err) {}
    }

    if (placeholder) placeholder.remove();
    appendMessage({ role: 'system', content: reply });
  } catch (error) {
    if (bubbleEl) bubbleEl.textContent = 'Network error';
  } finally {
    waitingResponse = false;
    setThinking(false);
  }
}

whyButton.addEventListener('click', () => {
  whyButton.blur();
  showChat();
});

const backButton = document.getElementById('back-button');
backButton.addEventListener('click', showHero);

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

async function refreshStatus() {
  try {
    const healthUrl = BASE_URL ? `${BASE_URL}/health` : '/health';
    const response = await fetch(healthUrl);
    if (!response.ok) {
      statusEl.textContent = (BASE_URL ? `Ollama (${BASE_URL}): down` : 'Ollama: down');
      return;
    }
    const json = await response.json().catch(() => null);
    statusEl.textContent = json && json.ok ? (BASE_URL ? `Ollama (${BASE_URL}): up` : 'Ollama: up') : 'Ollama: limited';
  } catch (error) {
    statusEl.textContent = BASE_URL ? `Ollama (${BASE_URL}): unreachable` : 'Ollama: unreachable';
  }
}

// Perform initial health check and poll; the init IIFE above will set `BASE_URL`
// (if `/endpoint.json` exists) before the first check completes in most cases.
refreshStatus();
setInterval(refreshStatus, 15000);

// Settings button: allow user to set a public Ollama endpoint (e.g. ngrok/localtunnel URL)
const settingsBtn = document.getElementById('settings-button');
if (settingsBtn) {
  settingsBtn.addEventListener('click', () => {
    const current = getSavedEndpoint();
    const hint = current || (location.protocol === 'https:' ? 'https://your-tunnel.example' : 'http://127.0.0.1:3000');
    const input = prompt('Введите публичный URL Ollama (https://...) или оставьте пустым для локального сервера:', hint);
    if (input === null) return; // cancelled
    const value = (input || '').trim();
    try {
      if (value) localStorage.setItem('ollama_endpoint', value);
      else localStorage.removeItem('ollama_endpoint');
    } catch (e) {}
    // Update BASE_URL and refresh status
    if (typeof location !== 'undefined' && location.protocol === 'file:') {
      BASE_URL = getSavedEndpoint() || 'http://127.0.0.1:3000';
    } else {
      BASE_URL = getSavedEndpoint() || '';
    }
    refreshStatus();
    alert('Endpoint сохранён. Если страница работает на HTTPS, используйте HTTPS endpoint.');
  });
}
