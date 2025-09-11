"use strict";

// Immediately invoked function expression to avoid polluting global scope
(function() {
  // Path to our JSON data file.  A relative path is important so that
  // the app works both locally and when hosted from a subdirectory on
  // GitHub Pages.  The file must exist and contain a JSON array of
  // objects where each entry has the shape:
  //   { "day": <number>, "html": <html string> }
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
   * Minimal validation of HTML fragments. Reject anything that
   * contains script tags or inline event handlers. Images and other
   * unwanted elements are stripped elsewhere so we simply ignore
   * them here. We trust that entries were sanitised at build time.
   */
  function isValidHTML(html) {
    if (typeof html !== "string" || !html.trim()) return false;
    if (
      /<\s*script/i.test(html) ||
      /on\w+\s*=/.test(html)
    ) return false;
    return true;
  }

  /**
   * Strip elements we don't want from an HTML fragment.
   * Currently removes any <img> tags, legacy <font> elements and
   * trailing "Bible in a year" paragraphs.
   */
  function sanitizeHTML(html) {
    if (typeof html !== "string") return html;
    return html
      // drop images completely
      .replace(/<\s*img[^>]*>/gi, "")
      // remove deprecated font tags but keep their text
      .replace(/<\/?font[^>]*>/gi, "")
      // remove final Bible in a year paragraph
      .replace(/<p><strong>\s*Bible in a year:[\s\S]*?<\/p>/gi, "");
  }

  /**
   * Load the JSON file and select today’s thought.  Handles errors
   * gracefully by showing a fallback message.  Called once on
   * DOMContentLoaded.
   */
  async function load() {
    const metaEl = document.getElementById('meta');
    const thoughtEl = document.getElementById('thought');
    const aboutBtn = document.getElementById('about-button');
    const aboutSection = document.getElementById('about-section');
    // Toggle about section
    if (aboutBtn && aboutSection) {
      aboutBtn.addEventListener('click', () => {
        const isHidden = aboutSection.style.display === 'none';
        aboutSection.style.display = isHidden ? 'block' : 'none';
      });
    }
    try {
      let res;
      try {
        res = await fetch(DATA_URL, { cache: 'no-store' });
      } catch (netErr) {
        console.error(`Failed to fetch ${DATA_URL}`, netErr);
        throw netErr;
      }
      if (!res.ok) {
        console.error(`Fetch to ${DATA_URL} returned HTTP ${res.status}`);
        throw new Error(`HTTP ${res.status}`);
      }
      let arr;
      try {
        arr = await res.json();
      } catch (parseErr) {
        console.error(`Could not parse JSON from ${DATA_URL}`, parseErr);
        throw parseErr;
      }
      if (!Array.isArray(arr)) {
        console.error('Thoughts file did not contain an array', arr);
        throw new Error('Invalid data format');
      }
      const clean = arr
        .map(o => {
          if (!o || !Number.isInteger(o.day) || typeof o.html !== "string") {
            console.warn('Skipping entry with missing fields', o);
            return null;
          }
          const sanitized = sanitizeHTML(o.html);
          if (!isValidHTML(sanitized)) {
            console.warn(`Skipping day ${o.day} due to invalid HTML`);
            return null;
          }
          return { day: o.day, body_text: sanitized };
        })
        .filter(Boolean);
      if (clean.length === 0) {
        console.error(`Loaded ${arr.length} entries but none valid`);
        throw new Error('No valid thoughts found');
      }
      if (clean.length < arr.length) {
        console.warn(`Filtered out ${arr.length - clean.length} invalid entries`);
      }
      // sort by day ascending just in case
      state.thoughts = clean.sort((a, b) => a.day - b.day);
      state.idx = chooseIndex(state.thoughts.length);
      state.today = state.thoughts[state.idx];
      render(metaEl, thoughtEl);

      // Set up previous button handler after successful load
      const prevBtn = document.getElementById('prev-button');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          if (!state.thoughts || state.thoughts.length === 0) return;
          state.idx = (state.idx - 1 + state.thoughts.length) % state.thoughts.length;
          state.today = state.thoughts[state.idx];
          render(metaEl, thoughtEl);
        });
      }
    } catch (err) {
      console.error('Unable to load thoughts.json', err);
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
    const label = `Day ${t.day}`;
    metaEl.textContent = `${label} • entry ${state.idx + 1} of ${total}`;
    thoughtEl.innerHTML = t.body_text;
    // Normalise any inline styles so that typography is consistent.
    thoughtEl.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      if (/color:\s*(#C9211E|rgb\(\s*201\s*,\s*33\s*,\s*30\s*\))/i.test(style)) {
        el.classList.add('red-text');
      }
      el.removeAttribute('style');
    });
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
    thoughtEl.innerHTML = ' Today\'s entry is unavailable. Here\'s a timeless reminder: “You are loved.” Take a moment to pray and give thanks. ';
  }

  // Kick off the load once DOM has finished initial parsing
  window.addEventListener('DOMContentLoaded', load);
})();
