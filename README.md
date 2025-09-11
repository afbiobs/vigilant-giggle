# Thought for the Day static site

This repository contains a fully client‑side implementation of a “Thought
for the Day” devotional.  Entries were converted from the source
document provided by the user and stored in `data/thoughts.json` as an
array of objects.  Each object contains a `day` (1‑based) and an
`html` field holding the complete HTML string for that day’s
devotional.

The site consists of a single HTML page (`index.html`) with a small
stylesheet (`assets/styles.css`) and a script (`assets/app.js`).  On
page load the script chooses an entry based on the day‑of‑year in the
Europe/London timezone and renders it.  All links in the content open
in new tabs with `rel="noopener"` to improve security.  If the JSON
cannot be loaded or contains no valid entries a fallback message is
shown instead.

To run the site locally, open `index.html` in your browser.  To deploy
on GitHub Pages, push the contents of this repository to your `main`
branch and enable Pages in the repository settings.  Because all
resources use relative paths, the site will work from any path on
GitHub Pages.
