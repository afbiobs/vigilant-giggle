#!/usr/bin/env python3
"""
Thought for the Day - Data Preparation Script

This script processes a Word document containing daily devotional content,
cleans the formatting, validates structure, and outputs:
1. Individual JSON files for each day (for fast loading)
2. A master index file
3. A validation report showing any issues found

Usage:
    python prepare_thoughts.py input.docx output_directory/
"""

!pip install python-docx
import os
import re
import json
import html
from pathlib import Path
from datetime import datetime
from docx import Document
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

# ================= CONFIGURATION FOR COLAB =================
INPUT_DOCX = "Day 32-66.docx" 
OUTPUT_DIR = "processed_thoughts"               
# ===========================================================

@dataclass
class ParseDiagnostic:
    """Tracks why a paragraph was classified a certain way."""
    paragraph_index: int
    raw_text: str
    classification: str
    reason: str
    matched_pattern: Optional[str] = None

@dataclass
class EntryValidation:
    """Validation result for a single day's entry."""
    day: int
    title: str
    missing_sections: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    diagnostics: List[ParseDiagnostic] = field(default_factory=list)
    
    @property
    def is_complete(self) -> bool:
        return len(self.missing_sections) == 0


class RobustThoughtProcessor:
    """
    A tolerant parser for devotional content that handles inconsistent formatting
    and provides detailed diagnostics for troubleshooting.
    """
    
    def __init__(self):
        # URL detection
        self.url_regex = r'(https?://[^\s<>"]+?)(?=[.,;!?]?(\s|$))'
        
        # Flexible patterns for section detection (case-insensitive)
        # Each pattern is a tuple of (compiled_regex, description)
        self.day_patterns = [
            (re.compile(r'^Day\s+(\d+)', re.IGNORECASE), "Day N"),
            (re.compile(r'^(\d+)\s*[-–—:]\s*Day', re.IGNORECASE), "N - Day"),
            (re.compile(r'^#?\s*(\d+)\s*$'), "Standalone number"),
        ]
        
        self.study_text_patterns = [
            (re.compile(r'study\s*text', re.IGNORECASE), "study text"),
            (re.compile(r'scripture\s*ref', re.IGNORECASE), "scripture ref"),
            (re.compile(r'text\s*:\s*', re.IGNORECASE), "text:"),
            (re.compile(r'reading\s*:\s*', re.IGNORECASE), "reading:"),
            (re.compile(r'verse\s*:\s*', re.IGNORECASE), "verse:"),
            (re.compile(r'passage\s*:\s*', re.IGNORECASE), "passage:"),
        ]
        
        self.prayer_patterns = [
            (re.compile(r'^prayer\s*[:\-–—]+', re.IGNORECASE), "Prayer:-"),
            (re.compile(r'^prayer\s*$', re.IGNORECASE), "Prayer (standalone)"),
            (re.compile(r'^\*?\*?prayer\*?\*?\s*[:\-–—]*', re.IGNORECASE), "**Prayer**"),
            (re.compile(r'^let\s+us\s+pray', re.IGNORECASE), "Let us pray"),
        ]
        
        self.bible_reading_patterns = [
            (re.compile(r'bible\s+(in|on)\s+a?\s*year', re.IGNORECASE), "Bible in a year"),
            (re.compile(r'bible\s+reading\s*plan', re.IGNORECASE), "Bible reading plan"),
            (re.compile(r'daily\s+reading', re.IGNORECASE), "Daily reading"),
            (re.compile(r'today.?s?\s+reading', re.IGNORECASE), "Today's reading"),
            (re.compile(r'further\s+reading', re.IGNORECASE), "Further reading"),
            (re.compile(r'read\s+also', re.IGNORECASE), "Read also"),
            (re.compile(r'additional\s+reading', re.IGNORECASE), "Additional reading"),
        ]
        
        # Patterns to extract the actual content after a label
        self.label_strip_patterns = [
            re.compile(r'^prayer\s*[:\-–—]+\s*', re.IGNORECASE),
            re.compile(r'^bible\s+(in|on)\s+a?\s*year\s*(reading\s*plan)?\s*[:\-–—]*\s*', re.IGNORECASE),
            re.compile(r'^(daily|today.?s?|further|additional)\s+reading\s*[:\-–—]*\s*', re.IGNORECASE),
            re.compile(r'^read\s+also\s*[:\-–—]*\s*', re.IGNORECASE),
            re.compile(r'^study\s*text\s*[:\-–—]*\s*', re.IGNORECASE),
        ]

    def _match_any_pattern(self, text: str, patterns: list) -> tuple[bool, Optional[str], Optional[re.Match]]:
        """Try to match text against a list of patterns."""
        for pattern, desc in patterns:
            match = pattern.search(text)
            if match:
                return True, desc, match
        return False, None, None
    
    def _strip_label(self, text: str) -> str:
        """Remove common labels from the start of text."""
        result = text
        for pattern in self.label_strip_patterns:
            result = pattern.sub('', result).strip()
        return result
    
    def _looks_like_scripture_reference(self, text: str) -> bool:
        """Check if text looks like a Bible reference (e.g., 'John 3:16' or 'Genesis 1:1-10')."""
        # Common patterns for scripture references
        scripture_patterns = [
            r'\d+\s*:\s*\d+',  # Chapter:verse
            r'\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\b',
        ]
        for pat in scripture_patterns:
            if re.search(pat, text, re.IGNORECASE):
                return True
        return False

    def apply_formatting(self, text: str, run, entry_meta: dict) -> str:
        """Apply HTML formatting based on Word run properties."""
        if not text:
            return ""
        formatted = html.escape(text)

        # Detect and convert URLs
        def link_repl(match):
            entry_meta['has_links'] = True
            url = match.group(1)
            return f'<a href="{url}" target="_blank">{url}</a>'
        formatted = re.sub(self.url_regex, link_repl, formatted)

        # Apply Red Color (FF0000)
        if run.font.color and run.font.color.rgb and str(run.font.color.rgb) == "FF0000":
            formatted = f'<span class="red-text" style="color:red;">{formatted}</span>'
            entry_meta['has_highlights'] = True

        if run.bold:
            formatted = f'<b>{formatted}</b>'
        if run.italic:
            formatted = f'<i>{formatted}</i>'
        return formatted

    def get_paragraph_content(self, paragraph, entry_meta: dict) -> str:
        """Extract HTML content from a paragraph, handling hyperlinks."""
        p_html = ""
        for child in paragraph._element.getchildren():
            if child.tag.endswith('hyperlink'):
                r_id = child.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                if r_id and r_id in paragraph.part.rels:
                    url = paragraph.part.rels[r_id].target_ref
                    link_text = "".join([
                        node.text for node in 
                        child.findall('.//{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')
                        if node.text
                    ])
                    p_html += f'<a href="{url}" target="_blank">{html.escape(link_text)}</a>'
                    entry_meta['has_links'] = True
            elif child.tag.endswith('r'):
                from docx.text.run import Run
                run_obj = Run(child, paragraph)
                p_html += self.apply_formatting(run_obj.text, run_obj, entry_meta)
        return p_html

    def classify_paragraph(self, raw_text: str, para_index: int, state: dict) -> tuple[str, ParseDiagnostic]:
        """
        Classify a paragraph and return its type plus diagnostic info.
        
        Returns: (classification, diagnostic)
        """
        text_upper = raw_text.upper()
        
        # Check for Day marker
        for pattern, desc in self.day_patterns:
            match = pattern.match(raw_text)
            if match:
                return "DAY_MARKER", ParseDiagnostic(
                    para_index, raw_text, "DAY_MARKER",
                    f"Matched day pattern: {desc}",
                    matched_pattern=desc
                )
        
        # Check for Study Text / Scripture Reference header
        matched, desc, _ = self._match_any_pattern(raw_text, self.study_text_patterns)
        if matched:
            return "STUDY_TEXT_HEADER", ParseDiagnostic(
                para_index, raw_text, "STUDY_TEXT_HEADER",
                f"Matched study text pattern: {desc}",
                matched_pattern=desc
            )
        
        # Check for Prayer
        matched, desc, _ = self._match_any_pattern(raw_text, self.prayer_patterns)
        if matched:
            return "PRAYER", ParseDiagnostic(
                para_index, raw_text, "PRAYER",
                f"Matched prayer pattern: {desc}",
                matched_pattern=desc
            )
        
        # Check for Bible Reading
        matched, desc, _ = self._match_any_pattern(raw_text, self.bible_reading_patterns)
        if matched:
            return "BIBLE_READING", ParseDiagnostic(
                para_index, raw_text, "BIBLE_READING",
                f"Matched Bible reading pattern: {desc}",
                matched_pattern=desc
            )
        
        # Context-dependent classification based on state
        if state.get('awaiting_title'):
            return "TITLE", ParseDiagnostic(
                para_index, raw_text, "TITLE",
                "First non-day paragraph after Day marker, interpreted as title"
            )
        
        if state.get('awaiting_scripture_ref'):
            if self._looks_like_scripture_reference(raw_text):
                return "SCRIPTURE_REF", ParseDiagnostic(
                    para_index, raw_text, "SCRIPTURE_REF",
                    "Looks like a scripture reference (contains book name or chapter:verse pattern)"
                )
            else:
                return "SCRIPTURE_REF", ParseDiagnostic(
                    para_index, raw_text, "SCRIPTURE_REF",
                    "Expected scripture reference position (after Study Text header), but text doesn't look like typical reference - please verify"
                )
        
        if state.get('awaiting_scripture_text'):
            return "SCRIPTURE_TEXT", ParseDiagnostic(
                para_index, raw_text, "SCRIPTURE_TEXT",
                "First paragraph after scripture reference, interpreted as scripture text/quote"
            )
        
        # Default to devotional content
        return "DEVOTIONAL", ParseDiagnostic(
            para_index, raw_text, "DEVOTIONAL",
            "No special markers found, classified as devotional content"
        )

    def process(self, docx_path: str, output_folder: str) -> dict:
        """
        Process the DOCX file and return results with comprehensive diagnostics.
        """
        doc = Document(docx_path)
        output_path = Path(output_folder)
        output_path.mkdir(parents=True, exist_ok=True)

        entries = []
        validations = []
        current_entry = None
        current_validation = None
        
        # Parser state machine
        state = {
            'awaiting_title': False,
            'awaiting_scripture_ref': False,
            'awaiting_scripture_text': False,
            'in_devotional': False,
        }
        
        def reset_state():
            state['awaiting_title'] = True
            state['awaiting_scripture_ref'] = False
            state['awaiting_scripture_text'] = False
            state['in_devotional'] = False

        for para_index, para in enumerate(doc.paragraphs):
            raw_text = para.text.strip()
            if not raw_text:
                continue

            classification, diagnostic = self.classify_paragraph(raw_text, para_index, state)
            
            if classification == "DAY_MARKER":
                # Save previous entry if exists
                if current_entry:
                    entries.append(current_entry)
                if current_validation:
                    validations.append(current_validation)
                
                # Extract day number
                day_num = None
                for pattern, _ in self.day_patterns:
                    match = pattern.match(raw_text)
                    if match:
                        day_num = int(match.group(1))
                        break
                
                current_entry = {
                    "day": day_num,
                    "title": "",
                    "scripture_ref": "",
                    "scripture_text": "",
                    "devotional": "",
                    "prayer": "",
                    "bible_reading": "",
                    "has_links": False,
                    "has_highlights": False,
                    "temp_devotional_list": [],
                }
                current_validation = EntryValidation(day=day_num, title="")
                current_validation.diagnostics.append(diagnostic)
                reset_state()
                continue
            
            if not current_entry:
                # Content before first Day marker - skip but note it
                continue
            
            current_validation.diagnostics.append(diagnostic)
            p_html = self.get_paragraph_content(para, current_entry)
            
            if classification == "TITLE" and not current_entry["title"]:
                current_entry["title"] = raw_text
                current_validation.title = raw_text
                state['awaiting_title'] = False
                
            elif classification == "STUDY_TEXT_HEADER":
                state['awaiting_scripture_ref'] = True
                state['awaiting_title'] = False
                # Check if reference is inline (after colon)
                if ":" in raw_text:
                    after_colon = raw_text.split(":", 1)[1].strip()
                    if after_colon and self._looks_like_scripture_reference(after_colon):
                        current_entry["scripture_ref"] = after_colon
                        state['awaiting_scripture_ref'] = False
                        state['awaiting_scripture_text'] = True
                        
            elif classification == "SCRIPTURE_REF" and state.get('awaiting_scripture_ref'):
                current_entry["scripture_ref"] = self._strip_label(raw_text)
                state['awaiting_scripture_ref'] = False
                state['awaiting_scripture_text'] = True
                
            elif classification == "SCRIPTURE_TEXT" and state.get('awaiting_scripture_text'):
                current_entry["scripture_text"] = p_html
                state['awaiting_scripture_text'] = False
                state['in_devotional'] = True
                
            elif classification == "PRAYER":
                prayer_content = self._strip_label(raw_text)
                current_entry["prayer"] = prayer_content
                state['in_devotional'] = False
                
            elif classification == "BIBLE_READING":
                reading_content = self._strip_label(raw_text)
                current_entry["bible_reading"] = reading_content
                state['in_devotional'] = False
                
            elif classification == "DEVOTIONAL":
                # Also catch title if we haven't got one yet
                if not current_entry["title"]:
                    current_entry["title"] = raw_text
                    current_validation.title = raw_text
                    state['awaiting_title'] = False
                else:
                    current_entry["temp_devotional_list"].append(f"<p>{p_html}</p>")
                    state['in_devotional'] = True
            
            else:
                # Catch-all: add to devotional
                if state.get('awaiting_title') and not current_entry["title"]:
                    current_entry["title"] = raw_text
                    current_validation.title = raw_text
                    state['awaiting_title'] = False
                else:
                    current_entry["temp_devotional_list"].append(f"<p>{p_html}</p>")

        # Don't forget the last entry
        if current_entry:
            entries.append(current_entry)
        if current_validation:
            validations.append(current_validation)

        # Validate entries and build output
        master_index = []
        validation_report = []
        
        for i, entry in enumerate(entries):
            entry["devotional"] = "\n".join(entry["temp_devotional_list"])
            validation = validations[i] if i < len(validations) else None
            
            # Check for missing sections
            missing = []
            warnings = []
            
            if not entry["title"]:
                missing.append("title")
            if not entry["scripture_ref"]:
                missing.append("scripture_ref")
            if not entry["scripture_text"]:
                missing.append("scripture_text")
            if not entry["devotional"].strip():
                missing.append("devotional")
            elif len(entry["temp_devotional_list"]) < 2:
                warnings.append(f"Devotional seems short (only {len(entry['temp_devotional_list'])} paragraph(s))")
            if not entry["prayer"]:
                missing.append("prayer")
            if not entry["bible_reading"]:
                missing.append("bible_reading")
            
            if validation:
                validation.missing_sections = missing
                validation.warnings = warnings
            
            # Construct HTML
            entry["html"] = (
                f"<h2 class='thought-title'>{html.escape(entry['title'])}</h2>"
                f"<div class='scripture-ref'>{html.escape(entry['scripture_ref'])}</div>"
                f"<div class='scripture-text'>{entry['scripture_text']}</div>"
                f"<div class='devotional'>{entry['devotional']}</div>"
                f"<div class='prayer'><b>Prayer:</b> {html.escape(entry['prayer'])}</div>"
                f"<div class='bible-reading'><b>Bible in a year reading plan:</b> {html.escape(entry['bible_reading'])}</div>"
            )

            del entry["temp_devotional_list"]
            
            # Write individual JSON file
            file_name = f"day-{entry['day']:03d}.json"
            with open(output_path / file_name, 'w', encoding='utf-8') as f:
                json.dump(entry, f, indent=2, ensure_ascii=False)

            master_index.append({
                "day": entry["day"],
                "title": entry["title"],
                "file": file_name,
                "has_links": entry["has_links"],
                "has_highlights": entry["has_highlights"],
                "is_complete": len(missing) == 0,
                "missing_sections": missing,
            })
            
            # Build validation report entry
            if missing or warnings:
                validation_report.append({
                    "day": entry["day"],
                    "title": entry["title"][:50] + "..." if len(entry["title"]) > 50 else entry["title"],
                    "missing": missing,
                    "warnings": warnings,
                    "diagnostics": [
                        {
                            "para_index": d.paragraph_index,
                            "text_preview": d.raw_text[:80] + "..." if len(d.raw_text) > 80 else d.raw_text,
                            "classification": d.classification,
                            "reason": d.reason,
                        }
                        for d in (validation.diagnostics if validation else [])
                    ]
                })

        # Write master index
        with open(output_path / "index.json", 'w', encoding='utf-8') as f:
            json.dump({
                "generated": datetime.now().isoformat(),
                "total_days": len(entries),
                "complete_days": sum(1 for e in master_index if e["is_complete"]),
                "incomplete_days": sum(1 for e in master_index if not e["is_complete"]),
                "days": master_index
            }, f, indent=2)

        # Write detailed validation report
        with open(output_path / "validation_report.json", 'w', encoding='utf-8') as f:
            json.dump({
                "generated": datetime.now().isoformat(),
                "summary": {
                    "total_entries": len(entries),
                    "complete": sum(1 for v in validation_report if not v["missing"]),
                    "incomplete": len(validation_report),
                },
                "issues": validation_report
            }, f, indent=2, ensure_ascii=False)

        # Generate human-readable report
        report_lines = self._generate_human_report(entries, validation_report)
        report_text = "\n".join(report_lines)
        
        with open(output_path / "validation_report.txt", 'w', encoding='utf-8') as f:
            f.write(report_text)

        return {
            "success": True,
            "total_entries": len(entries),
            "complete": len(entries) - len(validation_report),
            "incomplete": len(validation_report),
            "report": report_text,
            "output_path": str(output_path),
        }

    def _generate_human_report(self, entries: list, validation_report: list) -> list:
        """Generate a human-readable validation report."""
        lines = [
            "=" * 70,
            "THOUGHT PROCESSOR - VALIDATION REPORT",
            "=" * 70,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total entries processed: {len(entries)}",
            f"Complete entries: {len(entries) - len(validation_report)}",
            f"Entries with issues: {len(validation_report)}",
            "=" * 70,
            "",
        ]
        
        if not validation_report:
            lines.append("✅ All entries are complete! No issues found.")
            return lines
        
        lines.append("ENTRIES WITH MISSING SECTIONS OR WARNINGS:")
        lines.append("-" * 70)
        
        for issue in validation_report:
            lines.append("")
            lines.append(f"📅 DAY {issue['day']}: {issue['title']}")
            lines.append("-" * 40)
            
            if issue['missing']:
                lines.append(f"  ❌ MISSING SECTIONS: {', '.join(issue['missing'])}")
            
            if issue['warnings']:
                for w in issue['warnings']:
                    lines.append(f"  ⚠️  WARNING: {w}")
            
            lines.append("")
            lines.append("  PARAGRAPH ANALYSIS (what the parser saw):")
            
            for d in issue['diagnostics']:
                classification_emoji = {
                    "DAY_MARKER": "🔢",
                    "TITLE": "📌",
                    "STUDY_TEXT_HEADER": "📖",
                    "SCRIPTURE_REF": "📜",
                    "SCRIPTURE_TEXT": "✝️",
                    "PRAYER": "🙏",
                    "BIBLE_READING": "📚",
                    "DEVOTIONAL": "💭",
                }.get(d['classification'], "❓")
                
                lines.append(f"    {classification_emoji} [{d['classification']}] Para #{d['para_index']}")
                lines.append(f"       Text: \"{d['text_preview']}\"")
                lines.append(f"       Why:  {d['reason']}")
            
            lines.append("")
            
            # Provide specific guidance for each missing section
            if issue['missing']:
                lines.append("  💡 SUGGESTIONS TO FIX:")
                
                for missing in issue['missing']:
                    if missing == "scripture_ref":
                        lines.append("     - Add 'Study Text: [Book Chapter:Verse]' line after the title")
                        lines.append("       Example: 'Study Text: John 3:16-18'")
                    elif missing == "scripture_text":
                        lines.append("     - Add the actual scripture quote after the reference line")
                    elif missing == "prayer":
                        lines.append("     - Add 'Prayer:- [prayer text]' or 'Prayer: [prayer text]'")
                    elif missing == "bible_reading":
                        lines.append("     - Add 'Bible in a year: [references]' or 'Bible reading plan: [refs]'")
                    elif missing == "devotional":
                        lines.append("     - Ensure there's body text between scripture and prayer")
                    elif missing == "title":
                        lines.append("     - Ensure there's a title line after 'Day N'")
            
            lines.append("")
        
        lines.append("=" * 70)
        lines.append("END OF REPORT")
        lines.append("=" * 70)
        
        return lines


def main():
    processor = RobustThoughtProcessor()
    result = processor.process(INPUT_DOCX, OUTPUT_DIR)
    
    print(result["report"])
    print()
    print(f"Output written to: {result['output_path']}")
    print(f"- Individual day files: day-NNN.json")
    print(f"- Master index: index.json")
    print(f"- Validation reports: validation_report.json, validation_report.txt")


if __name__ == "__main__":
    main()
