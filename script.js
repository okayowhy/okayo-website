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
    const resp = await fetch(`/api/generate`, {
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
    const response = await fetch('/health');
    if (!response.ok) {
      statusEl.textContent = 'Ollama: down';
      return;
    }
    const json = await response.json().catch(() => null);
    statusEl.textContent = json && json.ok ? 'Ollama: up' : 'Ollama: limited';
  } catch (error) {
    statusEl.textContent = 'Ollama: unreachable';
  }
}

refreshStatus();
setInterval(refreshStatus, 15000);
