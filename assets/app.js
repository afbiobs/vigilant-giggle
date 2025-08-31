"use strict";

// Immediately invoked function expression to avoid polluting global scope
(function() {
  /*
   * Path to our JSON data file.  A relative path is important so that
   * the app works both locally and when hosted from a subdirectory on
   * GitHub Pages.  The file must exist and contain a JSON array of
   * objects as described in the project brief.
   */
  const DATA_URL = "data/thoughts.json";

  // We must always use the Europe/London time zone when computing
  // the current day of year, regardless of where the viewer is
  // physically located.  This ensures that UK readers see the same
  // devotional on the same calendar day.
  const TZ = "Europe/London";

  // Internal state for the app
  const state = {
    thoughts: [],     // array of entries loaded from JSON
    idx: 0,           // index into thoughts for today
    today: null       // the selected thought object
  };

  /**
   * Get the current date components (year, month, day) in the UK time zone.
   * Returns an object { y, m, d }.
   */
  function getUKYMD(d = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return { y: +map.year, m: +map.month, d: +map.day };
  }

  /**
   * Compute the day-of-year (1–366) in the Europe/London timezone.
   */
  function doyUK(d = new Date()) {
    const { y, m, d: dd } = getUKYMD(d);
    const ts = Date.UTC(y, m - 1, dd);
    const jan1 = Date.UTC(y, 0, 1);
    return Math.floor((ts - jan1) / 86400000) + 1;
  }

  /**
   * Given the length of our thoughts array, compute the index for
   * today.  If the array is empty return zero.  The modulo ensures
   * that we wrap around if there are fewer than 366 entries.
   */
  function chooseIndex(len) {
    if (!len || len <= 0) return 0;
    const idx = (doyUK() - 1) % len;
    return (idx >= 0 && idx < len) ? idx : 0;
  }

  /**
   * Minimal validation of HTML fragments.  Reject anything that
   * contains script tags or inline event handlers.  We trust that
   * entries were sanitised at build time.
   */
  function isValidHTML(html) {
    if (typeof html !== "string" || !html.trim()) return false;
    if (/<\s*script/i.test(html) || /on\w+\s*=/.test(html)) return false;
    return true;
  }

  /**
   * Load the JSON file and select today’s thought.  Handles errors
   * gracefully by showing a fallback message.  Called once on
   * DOMContentLoaded.
   */
  async function load() {
    const metaEl = document.getElementById('meta');
    const thoughtEl = document.getElementById('thought');
    const yearEl = document.getElementById('year');
    yearEl.textContent = new Date().getFullYear();
    try {
      const res = await fetch(DATA_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.json();
      const clean = Array.isArray(arr)
        ? arr.filter(o => o && Number.isInteger(o.id) && isValidHTML(o.html))
        : [];
      if (clean.length === 0) throw new Error('No valid thoughts found');
      // sort by id ascending just in case
      state.thoughts = clean.sort((a, b) => a.id - b.id);
      state.idx = chooseIndex(state.thoughts.length);
      state.today = state.thoughts[state.idx];
      render(metaEl, thoughtEl);
    } catch (err) {
      console.warn('Load error', err);
      fallback(metaEl, thoughtEl);
    }
  }

  /**
   * Render today’s thought into the DOM.  Adds a meta line and
   * normalises anchor tags to open in new tabs.
   */
  function render(metaEl, thoughtEl) {
    const t = state.today;
    if (!t) {
      fallback(metaEl, thoughtEl);
      return;
    }
    const total = state.thoughts.length;
    const label = t.title ? `${t.title}` : `Day ${t.id + 1}`;
    metaEl.textContent = `${label} • entry ${state.idx + 1} of ${total}`;
    thoughtEl.innerHTML = t.html;
    // Normalise links: add noopener and open in new tab if not already specified
    thoughtEl.querySelectorAll('a[href]').forEach(a => {
      a.setAttribute('rel', 'noopener');
      if (!a.hasAttribute('target')) a.setAttribute('target', '_blank');
    });
  }

  /**
   * Show a fallback message when something goes wrong.  A simple
   * devotional line is shown so that users are never without
   * encouragement.
   */
  function fallback(metaEl, thoughtEl) {
    metaEl.textContent = 'Fallback';
    thoughtEl.innerHTML = '<p><em>Today\'s entry is unavailable. Here\'s a timeless reminder:</em></p><p><span class="red" style="color:#c00">“You are loved.”</span> Take a moment to pray and give thanks.</p>';
  }

  // Kick off the load once DOM has finished initial parsing
  window.addEventListener('DOMContentLoaded', load);
})();