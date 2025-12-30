# Troubleshooting Specific Issues

## Issue: Days 13 & 30 Not Parsing Correctly

### Day 13 Problem
**Format in Word doc:**
```
STUDY TEXT. Matthew 14:22-33
```

**Issue:** Scripture reference on SAME LINE as "STUDY TEXT." - parser expects it on next line

**Solution:**
Edit your Word document BEFORE processing:
```
STUDY TEXT

Matthew 14:22-33
```
(Add line break between "STUDY TEXT" and scripture reference)

### Day 30 Problem  
Similar to Day 13 - check if scripture reference is on same line as "STUDY TEXT"

## Issue: Long URLs Breaking Layout

### Current Workaround
URLs are clickable but display with full encoded characters. 

### Quick Fix Option 1: Edit JSON Files
After processing, you can manually clean URLs in the JSON files:

1. Open `data/day-001.json`
2. Find long URLs in the devotional text
3. Replace with simpler text:
```json
"Before: See https://very-long-url..."
"After: See [this article](https://very-long-url)"
```

### Quick Fix Option 2: CSS
The included CSS already handles long URLs by:
- Making them clickable
- Breaking them across lines on mobile
- Using smaller font for links

No action needed - it's already handled!

## Issue: Red Text (Jesus' Words) Not Preserved

**Why:** Pandoc (the conversion tool) doesn't preserve color information from Word docs.

### Solution Options:

#### Option 1: Manual HTML Editing (Most Control)
After processing, edit the HTML in JSON files:

1. Open day JSON file
2. Find Jesus' dialogue in the "html" field
3. Wrap in span tag:
```html
Before: <p>"Take courage! It is I. Don't be afraid."</p>

After: <p><span class="jesus-words">"Take courage! It is I. Don't be afraid."</span></p>
```

The CSS class `.jesus-words` is already defined with red color!

#### Option 2: Use Quotes as Indicators
The current display already shows quoted text distinctly. Jesus' words in quotes are visually different from narration.

#### Option 3: Accept As-Is
For most readers, the quotation marks provide sufficient indication of who's speaking.

### Future Enhancement
Could write a Python script using `python-docx` library to extract color information directly from Word, but this requires additional setup.

## Issue: Prayer Text Has Extra Dash

**Example:**
```
Prayer: - Father, thank you...
```

**Quick Fix:**
This is already handled by the cleaner! The script removes leading dashes.

If you still see them, run the text through cleaning again or manually edit the JSON.

## Best Practices to Avoid Issues

### 1. Consistent Formatting in Word

✅ **Good:**
```
Day 5

TITLE TEXT

STUDY TEXT

Scripture Reference

"Scripture passage text..."

Devotional content...

Prayer: Your prayer text

Bible in a year reading plan Genesis X-Y
```

❌ **Problematic:**
```
Day 5
TITLE TEXT
STUDY TEXT. Reference on same line
Scripture without quotes
```

### 2. Use Simple Formatting
- ✅ Bold for emphasis
- ✅ Italic for emphasis  
- ❌ Avoid colored text (except for specific styling)
- ❌ Avoid complex tables
- ❌ Avoid embedded images

### 3. Test Early
Process a few days first:
```bash
# Create a test document with just Days 1-5
python prepare_thoughts.py test.docx data_test/
# Check the validation report
cat data_test/validation_report.txt
```

## Quick Validation Checklist

After processing, check:
- [ ] All days have titles
- [ ] Scripture references captured
- [ ] Devotional content present (should be 500+ chars typically)
- [ ] Prayer text extracted
- [ ] Reading plan included
- [ ] URLs are clickable
- [ ] Text displays correctly on mobile

## Getting Help

### Check These First:
1. **validation_report.txt** - Lists all issues found
2. **Sample JSON file** - Open day-001.json to see structure
3. **Browser console** - F12 to check for JavaScript errors
4. **UPDATE_NOTES.md** - Recent fixes and known issues

### Common Quick Fixes:
- **"Missing devotional"** → Check Word doc formatting, ensure content is there
- **"Missing scripture"** → Add line break after "STUDY TEXT"
- **"URLs weird"** → Already handled by CSS, just verify they're clickable
- **"Prayer missing"** → Ensure "Prayer:" label is present in Word doc

## Advanced: Manual JSON Editing

If you need to fix a specific day without reprocessing:

1. Open `data/day-XXX.json`
2. Edit the fields:
   - `title` - The devotional title
   - `scripture_ref` - e.g., "Luke 8:42b-48a"
   - `scripture_text` - The Bible passage
   - `devotional` - Main teaching content
   - `prayer` - Prayer text
3. **Important:** Also update the `html` field with matching content
4. Save and reload the page

Example structure:
```json
{
  "day": 1,
  "title": "Your Title",
  "scripture_ref": "Luke 8:42b-48a",
  "scripture_text": "Bible passage...",
  "devotional": "Teaching content...",
  "prayer": "Prayer text...",
  "html": "<h2>Your Title</h2>..."
}
```

---

**Remember:** The system works great for 29/31 days! The issues are specific to unusual formatting. When in doubt, keep it simple and consistent.
