# 🚀 Quick Start Guide

Get your Thought for the Day web app running in minutes!

## 📦 What You Have

Your complete devotional web app with:
- ✅ 31 days of parsed content
- ✅ Modern, responsive design
- ✅ Fast-loading individual day files
- ✅ Dark mode support
- ✅ Mobile app-like experience

## 🏃 Option 1: GitHub Pages (Recommended)

### Step 1: Create a GitHub Repository

1. Go to https://github.com/new
2. Name it something like `daily-thought` or `devotional`
3. Make it Public
4. Don't initialize with README (you already have one)
5. Click "Create repository"

### Step 2: Upload Your Files

**Easy way (using GitHub website):**
1. In your new repository, click "uploading an existing file"
2. Drag all the files from your `github-pages-site` folder
3. Commit the files

**Command line way (if you have git):**
```bash
cd github-pages-site
git init
git add .
git commit -m "Initial commit - Thought for the Day app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository settings
2. Click on "Pages" in the sidebar
3. Under "Source", select:
   - Branch: `main`
   - Folder: `/ (root)`
4. Click "Save"
5. Wait 1-2 minutes

### Step 4: Access Your Site

Your site will be live at:
```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

## 🖥️ Option 2: Test Locally First

### Quick Test
```bash
cd github-pages-site
python3 -m http.server 8000
```

Then visit: http://localhost:8000

### Using Node.js
```bash
cd github-pages-site
npx serve
```

## 🔄 Updating Content

When you want to update with new devotional content:

1. **Prepare new content:**
   ```bash
   python prepare_thoughts.py "New Devotional.docx" data/
   ```

2. **Review the validation report:**
   ```bash
   cat data/validation_report.txt
   ```

3. **Update your repository:**
   ```bash
   git add data/
   git commit -m "Update devotional content"
   git push
   ```

   Or upload the updated `data/` folder through GitHub's web interface.

Changes go live within 1-2 minutes!

## 📱 Add to Phone Home Screen

### iPhone
1. Open the site in Safari
2. Tap the Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Name it "Daily Thought" and tap Add

### Android
1. Open the site in Chrome
2. Tap the menu (⋮)
3. Tap "Add to Home Screen"
4. Name it and tap "Add"

Now it launches like a native app!

## 🎨 Customization

### Change Colors
Edit `assets/styles.css` and modify the CSS variables:
```css
:root {
    --color-accent: #4a90e2;  /* Your brand color */
    --max-width: 680px;       /* Content width */
}
```

### Change Title
Edit `index.html`:
```html
<title>Your Custom Title</title>
<h1 class="app-title">Your Custom Title</h1>
```

## ❓ Troubleshooting

**Problem: Page shows "Unable to Load"**
- Check browser console (F12) for errors
- Verify `data/index.json` exists
- Make sure file names match: `day-001.json`, `day-002.json`, etc.

**Problem: Site not updating on GitHub Pages**
- Wait 2-3 minutes after pushing
- Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Check GitHub Actions tab for build errors

**Problem: Wrong day showing**
- The app automatically shows today's day of year
- To test specific days, add `?day=5` to the URL
- Example: `https://yoursite.com/?day=5`

## 📊 Current Status

- **Days Processed:** 31
- **Validation:** Check `data/validation_report.txt` for any issues
- **First Day:** THE WOMAN WITH THE ISSUE OF BLOOD Part 1
- **Last Day:** JESUS' ANGER EXPRESSED THROUGH A MIRACLE part 2

## 🆘 Need Help?

1. Check the full README.md for detailed docs
2. View `data/validation_report.txt` for content issues
3. Test locally first using Python's http.server
4. Verify all files uploaded correctly to GitHub

---

**Ready to go!** Upload to GitHub Pages and share your devotional with the world! 🎉
