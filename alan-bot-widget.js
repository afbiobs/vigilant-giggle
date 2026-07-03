// alan-bot-widget.js
//
// A drop-in chat widget for the Alan devotional companion.
//
// Install on any page:
//
//   <!-- at the bottom of the page, just before </body> -->
//   <div data-alan-bot></div>
//   <script src="/alan-bot-widget.js"></script>
//
// The widget will mount inline inside the `data-alan-bot` div. If no
// such div is found, it falls back to a floating launcher in the
// bottom-right corner of the viewport.
//
// Configuration via <script> data attributes:
//   data-alan-bot-api="https://api.knowingjesusdaily.com"
//   data-alan-bot-title="Alan"
//   data-alan-bot-greeting="Hello. What is on your mind today?"
//   data-alan-bot-accent="#6b4a2b"
//   data-alan-bot-mode="auto"   // "auto" | "inline" | "floating"
//
// Programmatic API:
//   window.AlanBot.open()
//   window.AlanBot.close()
//   window.AlanBot.ask("What does the author say about shame?")
//   window.AlanBot.reset()
//
// All CSS lives in a single <style> tag injected at runtime. All class
// names are prefixed with `alan-` to avoid colliding with the host page.

(function () {
  'use strict';

  // ---- config -----------------------------------------------------------
  const DEFAULTS = {
    api: 'https://api.knowingjesusdaily.com',
    title: 'Alan',
    tagline: 'A devotional companion',
    greeting:
      'Hello. I am here to walk with you through scripture, slowly.\n' +
      'Ask me about a passage, a question you have been carrying, or what today\'s reflection might be about.',
    accent: '#6b4a2b',
    mode: 'auto',  // "auto" | "inline" | "floating"
  };

  function readConfig() {
    // The current <script> tag's data attributes drive the config. We look
    // for the most recent <script> that references this file.
    const scripts = document.querySelectorAll('script[src*="alan-bot-widget"]');
    const last = scripts[scripts.length - 1] || {};
    const ds = last.dataset || {};
    return {
      api: (ds.alanBotApi || DEFAULTS.api).replace(/\/+$/, ''),
      title: ds.alanBotTitle || DEFAULTS.title,
      tagline: ds.alanBotTagline || DEFAULTS.tagline,
      greeting: ds.alanBotGreeting || DEFAULTS.greeting,
      accent: ds.alanBotAccent || DEFAULTS.accent,
      mode: ds.alanBotMode || DEFAULTS.mode,
    };
  }

  // ---- styles -----------------------------------------------------------
  // All selectors scoped under `.alan-root` so they cannot leak out.
  // The accent color is inlined as a CSS variable on the root.
  const STYLE_ID = 'alan-bot-widget-styles';
  function injectStyles(accent) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
:root { --alan-accent: ${accent}; }

.alan-root {
  --alan-bg: #faf7f2;
  --alan-bg-elev: #ffffff;
  --alan-ink: #1c1d22;
  --alan-ink-soft: #4a4f5a;
  --alan-ink-faint: #7d8290;
  --alan-accent-soft: #d8c2a5;
  --alan-line: #ece5d8;
  --alan-user-bubble: #e8e1d2;
  --alan-bubble: #ffffff;
  --alan-shadow: 0 1px 2px rgba(28,29,34,0.04), 0 8px 24px rgba(28,29,34,0.08);
  --alan-radius: 14px;
  --alan-serif: 'Iowan Old Style','Palatino Linotype',Palatino,'Book Antiqua',Georgia,serif;
  --alan-sans: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;

  color: var(--alan-ink);
  font-family: var(--alan-sans);
  font-size: 16px;
  line-height: 1.55;
  box-sizing: border-box;
}
.alan-root *, .alan-root *::before, .alan-root *::after { box-sizing: border-box; }

@media (prefers-color-scheme: dark) {
  .alan-root {
    --alan-bg: #16151a;
    --alan-bg-elev: #1f1e25;
    --alan-ink: #ece8df;
    --alan-ink-soft: #b5b0a3;
    --alan-ink-faint: #807a6e;
    --alan-accent-soft: #6b4a2b;
    --alan-line: #2c2a32;
    --alan-user-bubble: #2a2832;
    --alan-bubble: #1f1e25;
    --alan-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3);
  }
}

/* --- inline mode (default if a target div is present) --- */
.alan-root.alan-inline {
  display: flex;
  flex-direction: column;
  max-width: 760px;
  margin: 2.5rem auto;
  border: 1px solid var(--alan-line);
  border-radius: var(--alan-radius);
  overflow: hidden;
  background: var(--alan-bg-elev);
  box-shadow: var(--alan-shadow);
}
.alan-root.alan-inline .alan-launcher { display: none; }
.alan-root.alan-inline .alan-window { display: flex; }

/* --- floating mode (default if no target div) --- */
.alan-root.alan-floating { position: fixed; z-index: 2147483000; }
.alan-root.alan-floating.alan-pos-br {
  right: 1.25rem; bottom: 1.25rem;
  display: flex; flex-direction: column; align-items: flex-end; gap: 0.6rem;
}
.alan-root.alan-floating .alan-launcher {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--alan-accent); color: #fff;
  border: 0; cursor: pointer;
  box-shadow: var(--alan-shadow);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; line-height: 1;
  transition: transform 0.1s;
}
.alan-root.alan-floating .alan-launcher:hover { transform: scale(1.05); }
.alan-root.alan-floating .alan-launcher:active { transform: scale(0.95); }
.alan-root.alan-floating.alan-closed .alan-window { display: none; }
.alan-root.alan-floating.alan-open   .alan-launcher { display: none; }
.alan-root.alan-floating.alan-open   .alan-window  { display: flex; }
.alan-root.alan-floating .alan-window {
  width: min(380px, calc(100vw - 2rem));
  height: min(560px, calc(100vh - 6rem));
  flex-direction: column;
  background: var(--alan-bg-elev);
  border: 1px solid var(--alan-line);
  border-radius: var(--alan-radius);
  box-shadow: var(--alan-shadow);
  overflow: hidden;
  animation: alan-pop 0.18s ease-out;
}
@keyframes alan-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}

/* --- header --- */
.alan-header {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.85rem 1rem;
  background: var(--alan-bg-elev);
  border-bottom: 1px solid var(--alan-line);
  flex-shrink: 0;
}
.alan-header-mark {
  color: var(--alan-accent); font-size: 1.2rem; line-height: 1;
}
.alan-header-text { flex: 1; min-width: 0; }
.alan-header-title {
  font-family: var(--alan-serif);
  font-size: 1.15rem; font-weight: 600;
  color: var(--alan-ink); line-height: 1.2;
}
.alan-header-tagline {
  font-family: var(--alan-serif);
  font-style: italic;
  font-size: 0.82rem;
  color: var(--alan-ink-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.alan-header-btn {
  background: transparent; border: 0; cursor: pointer;
  color: var(--alan-ink-faint);
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; line-height: 1;
}
.alan-header-btn:hover {
  background: var(--alan-line);
  color: var(--alan-ink);
}

/* --- messages --- */
.alan-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex; flex-direction: column; gap: 0.85rem;
  background: var(--alan-bg);
  scroll-behavior: smooth;
}
.alan-msg { display: flex; flex-direction: column; gap: 0.2rem; max-width: 90%; }
.alan-msg-user   { align-self: flex-end; }
.alan-msg-assistant { align-self: flex-start; }
.alan-msg-role {
  font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--alan-ink-faint); padding: 0 0.5rem;
}
.alan-bubble {
  padding: 0.7rem 0.95rem;
  border-radius: var(--alan-radius);
  background: var(--alan-bubble);
  box-shadow: 0 1px 2px rgba(28,29,34,0.04);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.96rem; line-height: 1.55;
}
.alan-msg-user .alan-bubble {
  background: var(--alan-user-bubble);
  border-bottom-right-radius: 4px;
}
.alan-msg-assistant .alan-bubble {
  border-bottom-left-radius: 4px;
  border-left: 3px solid var(--alan-accent-soft);
}
.alan-bubble.alan-thinking {
  color: var(--alan-ink-faint);
  font-style: italic;
}
.alan-bubble p { margin: 0 0 0.6rem; }
.alan-bubble p:last-child { margin-bottom: 0; }
.alan-bubble strong { font-weight: 600; }
.alan-bubble em { font-style: italic; }
.alan-bubble code {
  font-family: ui-monospace,SFMono-Regular,Menlo,monospace;
  font-size: 0.88em;
  background: var(--alan-line); padding: 0.1em 0.3em; border-radius: 4px;
}
.alan-sources {
  margin-top: 0.5rem; padding-top: 0.5rem;
  border-top: 1px dashed var(--alan-line);
  font-size: 0.78rem; color: var(--alan-ink-faint);
}
.alan-sources summary {
  cursor: pointer; user-select: none; color: var(--alan-ink-soft);
}
.alan-sources ul { margin: 0.4rem 0 0; padding-left: 1.2rem; }
.alan-sources li { margin-bottom: 0.15rem; }
.alan-sources li .alan-score { color: var(--alan-ink-faint); margin-left: 0.3em; }

/* --- composer --- */
.alan-composer {
  display: flex; gap: 0.5rem; align-items: flex-end;
  padding: 0.6rem;
  background: var(--alan-bg-elev);
  border-top: 1px solid var(--alan-line);
  flex-shrink: 0;
}
.alan-composer textarea {
  flex: 1;
  border: 0; background: transparent;
  resize: none;
  font-family: inherit; font-size: 0.95rem; line-height: 1.45;
  color: var(--alan-ink);
  outline: none;
  max-height: 120px;
  padding: 0.35rem 0.2rem;
}
.alan-composer textarea::placeholder { color: var(--alan-ink-faint); }
.alan-send {
  background: var(--alan-accent); color: #fff;
  border: 0; border-radius: 10px;
  padding: 0.5rem 0.95rem;
  font-size: 0.9rem; font-weight: 500;
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 0.35rem;
  min-height: 36px;
  transition: opacity 0.15s;
}
.alan-send:disabled { opacity: 0.5; cursor: not-allowed; }
.alan-spinner {
  width: 12px; height: 12px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: alan-spin 0.8s linear infinite;
}
@keyframes alan-spin { to { transform: rotate(360deg); } }

/* --- floating-mode full-screen on small viewports --- */
@media (max-width: 540px) {
  .alan-root.alan-floating.alan-pos-br {
    right: 0; bottom: 0; left: 0;
  }
  .alan-root.alan-floating.alan-open .alan-window {
    width: 100vw; height: 100dvh;
    height: 100vh;
    border-radius: 0;
  }
}
`;
    document.head.appendChild(style);
  }

  // ---- DOM construction ------------------------------------------------
  function buildWidget(config) {
    const root = document.createElement('div');
    root.className = 'alan-root';
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', config.title);
    root.innerHTML = `
      <button class="alan-launcher" type="button" aria-label="Open ${config.title}">✦</button>
      <section class="alan-window" aria-live="polite">
        <header class="alan-header">
          <span class="alan-header-mark" aria-hidden="true">✦</span>
          <div class="alan-header-text">
            <div class="alan-header-title"></div>
            <div class="alan-header-tagline"></div>
          </div>
          <button class="alan-header-btn alan-reset" type="button" title="Start a new conversation" aria-label="Reset conversation">↻</button>
          <button class="alan-header-btn alan-close" type="button" title="Close" aria-label="Close">✕</button>
        </header>
        <div class="alan-messages"></div>
        <form class="alan-composer" autocomplete="off">
          <textarea
            class="alan-input"
            rows="1"
            placeholder="Ask a question, or share what is on your mind…"
            maxlength="2000"
            aria-label="Your question"
            required></textarea>
          <button class="alan-send" type="submit" aria-label="Send">
            <span class="alan-send-label">Send</span>
            <span class="alan-spinner" hidden></span>
          </button>
        </form>
      </section>
    `;
    root.querySelector('.alan-header-title').textContent = config.title;
    root.querySelector('.alan-header-tagline').textContent = config.tagline;
    return root;
  }

  // ---- widget behaviour ------------------------------------------------
  function init(config) {
    injectStyles(config.accent);

    // Decide mount target and mode.
    const explicitInline = config.mode === 'inline';
    const explicitFloating = config.mode === 'floating';
    const inlineTarget =
      document.querySelector('[data-alan-bot]') ||
      (explicitInline ? document.createElement('div') : null);

    const useInline = !!inlineTarget;
    const root = buildWidget(config);

    if (useInline) {
      root.classList.add('alan-inline');
      inlineTarget.appendChild(root);
    } else {
      root.classList.add('alan-floating', 'alan-pos-br', 'alan-closed');
      document.body.appendChild(root);
    }

    // State
    let inFlight = false;

    // Element refs
    const messagesEl = root.querySelector('.alan-messages');
    const formEl     = root.querySelector('.alan-composer');
    const inputEl    = root.querySelector('.alan-input');
    const sendBtn    = root.querySelector('.alan-send');
    const spinnerEl  = root.querySelector('.alan-spinner');
    const sendLabel  = root.querySelector('.alan-send-label');
    const launcherEl = root.querySelector('.alan-launcher');
    const closeBtn   = root.querySelector('.alan-close');
    const resetBtn   = root.querySelector('.alan-reset');

    // Greeting
    function showGreeting() {
      messagesEl.innerHTML = '';
      const m = makeAssistantBubble(config.greeting, []);
      messagesEl.appendChild(m);
    }
    showGreeting();

    // Open / close (floating mode only)
    function open() {
      root.classList.remove('alan-closed');
      root.classList.add('alan-open');
      setTimeout(() => inputEl.focus(), 50);
    }
    function close() {
      root.classList.remove('alan-open');
      root.classList.add('alan-closed');
    }
    function reset() {
      showGreeting();
      inputEl.value = '';
      inputEl.style.height = 'auto';
    }

    if (launcherEl) launcherEl.addEventListener('click', open);
    if (closeBtn)  closeBtn.addEventListener('click', close);

    // Click-outside-to-close for floating
    if (!useInline) {
      document.addEventListener('click', (e) => {
        if (!root.classList.contains('alan-open')) return;
        if (root.contains(e.target)) return;
        close();
      });
    }

    // Reset
    if (resetBtn) resetBtn.addEventListener('click', reset);

    // Auto-grow textarea
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });

    // Enter to send
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        formEl.requestSubmit();
      } else if (e.key === 'Escape' && !useInline) {
        close();
      }
    });

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (inFlight) return;
      const question = inputEl.value.trim();
      if (!question) return;

      addUserBubble(question);
      inputEl.value = '';
      inputEl.style.height = 'auto';

      const thinking = addThinkingBubble();
      setBusy(true);
      try {
        const res = await fetch(config.api + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question }),
        });
        if (!res.ok) {
          const errText = await safeReadError(res);
          thinking.replaceWith(
            makeErrorBubble(`The server returned ${res.status}. ${errText || ''}`)
          );
          return;
        }
        const data = await res.json();
        thinking.replaceWith(makeAssistantBubble(data.answer || '(no answer)', data.sources || []));
      } catch (err) {
        thinking.replaceWith(makeErrorBubble(`The request failed. ${err.message || err}`));
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

    // Public programmatic API.
    window.AlanBot = {
      open, close, reset,
      ask(question) {
        inputEl.value = question;
        if (!useInline) open();
        formEl.requestSubmit();
      },
      mount(selector, opts) {
        // Re-mount into a new target. The original root is left in place;
        // callers should call this once on init if they want a different
        // target than the auto-detected one.
        const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!el) return;
        el.appendChild(root);
      },
    };
  }

  // ---- bubble helpers --------------------------------------------------
  function makeAssistantBubble(text, sources) {
    const wrap = document.createElement('div');
    wrap.className = 'alan-msg alan-msg-assistant';
    const role = document.createElement('div');
    role.className = 'alan-msg-role';
    role.textContent = 'Alan';
    const bubble = document.createElement('div');
    bubble.className = 'alan-bubble';
    bubble.appendChild(renderMarkdown(text));

    if (sources && sources.length) {
      const details = document.createElement('details');
      details.className = 'alan-sources';
      const summary = document.createElement('summary');
      summary.textContent = `Sources (${sources.length})`;
      details.appendChild(summary);
      const ul = document.createElement('ul');
      for (const s of sources) {
        const li = document.createElement('li');
        li.textContent = s.label || s.id || '(source)';
        if (typeof s.score === 'number') {
          const sp = document.createElement('span');
          sp.className = 'alan-score';
          sp.textContent = `${Math.round(s.score * 100)}%`;
          li.appendChild(sp);
        }
        ul.appendChild(li);
      }
      details.appendChild(ul);
      bubble.appendChild(details);
    }

    wrap.appendChild(role);
    wrap.appendChild(bubble);
    return wrap;
  }

  function makeUserBubble(text) {
    const wrap = document.createElement('div');
    wrap.className = 'alan-msg alan-msg-user';
    const role = document.createElement('div');
    role.className = 'alan-msg-role';
    role.textContent = 'You';
    const bubble = document.createElement('div');
    bubble.className = 'alan-bubble';
    bubble.textContent = text;
    wrap.appendChild(role);
    wrap.appendChild(bubble);
    return wrap;
  }

  function makeErrorBubble(text) {
    const wrap = document.createElement('div');
    wrap.className = 'alan-msg alan-msg-assistant';
    const role = document.createElement('div');
    role.className = 'alan-msg-role';
    role.textContent = 'Alan';
    const bubble = document.createElement('div');
    bubble.className = 'alan-bubble';
    bubble.style.borderLeftColor = '#c44';
    bubble.textContent = text;
    wrap.appendChild(role);
    wrap.appendChild(bubble);
    return wrap;
  }

  function addUserBubble(text) {
    const messagesEl = document.querySelector('.alan-root .alan-messages');
    messagesEl.appendChild(makeUserBubble(text));
    scrollToBottom(messagesEl);
  }

  function addThinkingBubble() {
    const messagesEl = document.querySelector('.alan-root .alan-messages');
    const wrap = document.createElement('div');
    wrap.className = 'alan-msg alan-msg-assistant';
    const role = document.createElement('div');
    role.className = 'alan-msg-role';
    role.textContent = 'Alan';
    const bubble = document.createElement('div');
    bubble.className = 'alan-bubble alan-thinking';
    bubble.textContent = '…';
    wrap.appendChild(role);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    scrollToBottom(messagesEl);
    return wrap;
  }

  function scrollToBottom(el) {
    requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }

  async function safeReadError(res) {
    try { const j = await res.json(); return j.error ? `: ${j.error}` : ''; }
    catch { return ''; }
  }

  // Lightweight markdown: paragraphs, **bold**, *italic*, `code`. Newlines
  // inside a paragraph become real whitespace (we use white-space: pre-wrap
  // on the bubble so blank lines from \n\n still break paragraphs).
  function renderMarkdown(text) {
    const frag = document.createDocumentFragment();
    const paragraphs = String(text || '').split(/\n{2,}/);
    for (const para of paragraphs) {
      const p = document.createElement('p');
      appendInline(p, para.trim());
      if (p.textContent || p.children.length) frag.appendChild(p);
    }
    return frag;
  }

  function appendInline(parent, text) {
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let lastIdx = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIdx) parent.appendChild(document.createTextNode(text.slice(lastIdx, m.index)));
      const tok = m[0];
      if (tok.startsWith('**'))      appendEl(parent, 'strong', tok.slice(2, -2));
      else if (tok.startsWith('*'))  appendEl(parent, 'em',     tok.slice(1, -1));
      else if (tok.startsWith('`'))  appendEl(parent, 'code',   tok.slice(1, -1));
      lastIdx = re.lastIndex;
    }
    if (lastIdx < text.length) parent.appendChild(document.createTextNode(text.slice(lastIdx)));
  }

  function appendEl(parent, tag, text) {
    const el = document.createElement(tag);
    el.textContent = text;
    parent.appendChild(el);
  }

  // ---- boot ------------------------------------------------------------
  function boot() {
    const config = readConfig();
    try {
      init(config);
    } catch (err) {
      console.error('[alan-bot] failed to init:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
