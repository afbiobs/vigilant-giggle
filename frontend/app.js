// Frontend chat client. Calls /api/chat on the same origin (no CORS
// issues because api.knowingjesusdaily.com and knowingjesusdaily.com share
// the same apex). Falls back to a relative /api/chat path so the same
// build works against a local wrangler dev server.

const messagesEl = document.getElementById('messages');
const formEl     = document.getElementById('composer');
const inputEl    = document.getElementById('input');
const sendBtn    = document.getElementById('send');
const spinnerEl  = sendBtn.querySelector('.send-spinner');
const sendLabel  = sendBtn.querySelector('.send-label');

let inFlight = false;

// Auto-grow the textarea up to 200px.
inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + 'px';
});

// Submit on Enter (Shift+Enter for newline).
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (inFlight) return;
  const question = inputEl.value.trim();
  if (!question) return;

  addMessage('user', question);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  const thinking = addMessage('assistant', '…', { thinking: true });

  setBusy(true);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const errText = await safeReadError(res);
      thinking.replaceWith(buildErrorBubble(`Sorry — the server returned ${res.status}. ${errText || ''}`));
      return;
    }
    const data = await res.json();
    thinking.replaceWith(buildAssistantBubble(data.answer || '(no answer)', data.sources || []));
  } catch (err) {
    thinking.replaceWith(buildErrorBubble(`Sorry — the request failed. ${err.message || err}`));
  } finally {
    setBusy(false);
    inputEl.focus();
  }
});

function setBusy(busy) {
  inFlight = busy;
  sendBtn.disabled = busy;
  spinnerEl.hidden = !busy;
  sendLabel.textContent = busy ? '' : 'Send';
  inputEl.disabled = busy;
}

function addMessage(role, text, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;
  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = role === 'user' ? 'You' : 'Alan';
  const bubble = document.createElement('div');
  bubble.className = 'bubble' + (opts.thinking ? ' thinking' : '');
  bubble.textContent = text;
  wrap.appendChild(roleEl);
  wrap.appendChild(bubble);
  messagesEl.appendChild(wrap);
  scrollToBottom();
  return wrap;
}

function buildAssistantBubble(answer, sources) {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant';

  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = 'Alan';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.appendChild(renderMarkdown(answer));

  if (sources.length) {
    const details = document.createElement('details');
    details.className = 'sources';
    const summary = document.createElement('summary');
    summary.textContent = `Sources (${sources.length})`;
    details.appendChild(summary);
    const ul = document.createElement('ul');
    for (const s of sources) {
      const li = document.createElement('li');
      li.textContent = s.label || s.id;
      if (typeof s.score === 'number') {
        const pct = (s.score * 100).toFixed(0);
        li.appendChild(document.createTextNode(` — ${pct}%`));
      }
      ul.appendChild(li);
    }
    details.appendChild(ul);
    bubble.appendChild(details);
  }

  wrap.appendChild(roleEl);
  wrap.appendChild(bubble);
  scrollToBottom();
  return wrap;
}

function buildErrorBubble(message) {
  const wrap = document.createElement('div');
  wrap.className = 'message assistant';
  const roleEl = document.createElement('div');
  roleEl.className = 'role';
  roleEl.textContent = 'Alan';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.style.borderLeftColor = '#c44';
  bubble.textContent = message;
  wrap.appendChild(roleEl);
  wrap.appendChild(bubble);
  return wrap;
}

// Minimal Markdown renderer: paragraphs, **bold**, *italic*, line breaks.
// Intentionally not a full parser — we just want light formatting from the
// LLM's output without pulling in a 100kB library.
function renderMarkdown(text) {
  const frag = document.createDocumentFragment();
  const paragraphs = text.split(/\n{2,}/);
  for (const para of paragraphs) {
    const p = document.createElement('p');
    appendInline(p, para.trim());
    if (p.textContent || p.children.length) frag.appendChild(p);
  }
  return frag;
}

function appendInline(parent, text) {
  // Tokenize: **bold**, *italic*, `code`. Single newlines become <br>.
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIdx = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parent.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      const b = document.createElement('strong');
      b.textContent = tok.slice(2, -2);
      parent.appendChild(b);
    } else if (tok.startsWith('*')) {
      const em = document.createElement('em');
      em.textContent = tok.slice(1, -1);
      parent.appendChild(em);
    } else if (tok.startsWith('`')) {
      const code = document.createElement('code');
      code.textContent = tok.slice(1, -1);
      parent.appendChild(code);
    }
    lastIdx = re.lastIndex;
  }
  if (lastIdx < text.length) {
    parent.appendChild(document.createTextNode(text.slice(lastIdx)));
  }
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}

async function safeReadError(res) {
  try {
    const j = await res.json();
    return j.error ? `: ${j.error}` : '';
  } catch {
    return '';
  }
}
