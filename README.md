# Thought for the Day - Modern Web App

A minimalist, fast-loading daily devotional web app designed to feel like a native mobile application.

## ✨ Features

- **🚀 Lightning Fast** - Individual JSON files per day for instant loading
- **📱 App-Like Experience** - Clean, modern UI that feels like a native app
- **🌓 Dark Mode** - Automatic dark mode support based on system preferences
- **♿ Accessible** - Full keyboard navigation and screen reader support
- **📴 Offline-Ready** - Optional service worker for offline access
- **📊 Data Validation** - Comprehensive checking and reporting of source content

## 🏗️ Architecture

### Data Structure
```
data/
├── index.json              # Master index with all days
├── day-001.json           # Individual day files
├── day-002.json
└── ...
```

### File Organization
```
project/
├── index.html             # Main HTML file
├── assets/
│   ├── styles.css        # Modern CSS with theming
│   └── app.js            # Progressive loading logic
├── data/                 # Generated data files
└── prepare_thoughts.py   # Data preparation script
```

## 📝 Workflow

### Step 1: Prepare Your Source Data

Your Word document should follow this structure for each day:

```
Day 1

TITLE OF DEVOTIONAL

STUDY TEXT

Scripture Reference (e.g., Luke 8:42b-48a)

"Scripture text goes here..."

Main devotional content...

Prayer: - Your prayer text here

Bible in a year reading plan Genesis 1-3
```

### Step 2: Clean and Process Data

Run the preparation script:

```bash
# Basic usage
python prepare_thoughts.py input.docx data/

# Example with your file
python prepare_thoughts.py "Devotional Content.docx" data/
```

This will:
1. ✅ Extract and clean all text from the Word document
2. ✅ Parse each day into structured data
3. ✅ Validate content and identify issues
4. ✅ Generate individual JSON files for each day
5. ✅ Create a master index file
6. ✅ Produce a detailed validation report

### Step 3: Review the Validation Report

Check `data/validation_report.txt` for:
- 🔴 **Issues** - Problems that need fixing
- ⚠️ **Warnings** - Items to review
- 📊 **Summary** - Overview of all processed days

### Step 4: Deploy to GitHub Pages

1. **Create/update your repository structure:**
   ```
   your-repo/
   ├── index.html
   ├── assets/
   │   ├── styles.css
   │   └── app.js
   └── data/
       ├── index.json
       ├── day-001.json
       └── ...
   ```

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Update devotional content"
   git push origin main
   ```

3. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Select branch: `main`
   - Select folder: `/ (root)`
   - Save

4. **Access your site:**
   - URL will be: `https://username.github.io/repo-name/`

## 🎨 Customization

### Colors and Theming

Edit CSS variables in `assets/styles.css`:

```css
:root {
    --color-accent: #4a90e2;        /* Primary accent color */
    --color-bg: #f8f9fa;            /* Background color */
    --color-surface: #ffffff;        /* Card/surface color */
    --color-text-primary: #1a1a2e;  /* Main text color */
    /* ... more variables ... */
}
```

### Typography

```css
:root {
    --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
    --font-serif: Georgia, 'Times New Roman', serif;
    --font-size-base: 16px;
}
```

### Spacing and Layout

```css
:root {
    --max-width: 680px;              /* Maximum content width */
    --border-radius: 12px;           /* Card border radius */
    --spacing-lg: 2rem;              /* Large spacing */
}
```

## 🔧 Advanced Features

### Progressive Web App (PWA)

To enable offline functionality, create `sw.js`:

```javascript
const CACHE_NAME = 'thought-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/styles.css',
  '/assets/app.js',
  '/data/index.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
```

### Custom Domain

1. Add a `CNAME` file to your repository:
   ```
   devotional.yourdomain.com
   ```

2. Configure DNS with your domain provider:
   ```
   Type: CNAME
   Name: devotional (or @)
   Value: username.github.io
   ```

### Analytics

Add to `index.html` before `</head>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🐛 Troubleshooting

### Data Not Loading

**Problem:** Blank page or "Unable to Load" error

**Solutions:**
1. Check browser console for errors (F12)
2. Verify `data/index.json` exists and is valid JSON
3. Ensure day files follow naming: `day-001.json`, `day-002.json`, etc.
4. Check file paths are correct (case-sensitive on GitHub)

### Formatting Issues

**Problem:** Text appears incorrectly formatted

**Solutions:**
1. Re-run `prepare_thoughts.py` with cleaned source
2. Check validation report for specific issues
3. Manually edit JSON files if needed
4. Ensure Word document follows expected structure

### Performance Issues

**Problem:** Slow loading on mobile

**Solutions:**
1. Reduce image sizes if any are embedded
2. Enable service worker for caching
3. Use browser's "Request Desktop Site" during development
4. Check network tab in DevTools for large files

## 📱 Mobile App Feel

### Add to Home Screen

**iOS:**
1. Open site in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. The app will open without browser chrome

**Android:**
1. Open site in Chrome
2. Tap menu (⋮)
3. Select "Add to Home Screen"
4. The app will open in standalone mode

## 📊 Data Format Reference

### index.json Structure
```json
{
  "generated": "2025-03-20T10:30:00",
  "total_days": 365,
  "days": [
    {
      "day": 1,
      "title": "Title of devotional",
      "scripture_ref": "Luke 8:42b-48a"
    }
  ]
}
```

### day-XXX.json Structure
```json
{
  "day": 1,
  "title": "Title",
  "study_text": "",
  "scripture_ref": "Luke 8:42b-48a",
  "scripture_text": "Full scripture text...",
  "devotional": "Main content...",
  "prayer": "Prayer text...",
  "bible_reading": "Genesis 1-3",
  "html": "<h2>Title</h2>..."
}
```

## 🔄 Updating Content

To update existing content:

1. Edit your Word document
2. Re-run the preparation script:
   ```bash
   python prepare_thoughts.py updated.docx data/
   ```
3. Review the validation report
4. Commit and push changes:
   ```bash
   git add data/
   git commit -m "Update content for days X-Y"
   git push
   ```

Changes will be live within minutes on GitHub Pages.

## ✅ Best Practices

1. **Always validate** - Check the validation report after processing
2. **Version control** - Keep source Word documents in Git with `.docx` tracking
3. **Consistent formatting** - Maintain structure in source documents
4. **Test locally** - Use `python -m http.server` to test before pushing
5. **Backup data** - Keep copies of both source documents and generated JSON

## 🆘 Support

For issues or questions:
1. Check the validation report for content issues
2. Review browser console for JavaScript errors
3. Verify all files are correctly deployed to GitHub
4. Test with a simple day file to isolate problems

## 📄 License

This project is open source. Customize and use as needed for your devotional content.

---

**Made with ❤️ for daily encouragement and reflection**
