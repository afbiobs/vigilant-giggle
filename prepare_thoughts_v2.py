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

import re
import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import html


class ThoughtProcessor:
    """Process and clean devotional content"""
    
    def __init__(self):
        self.issues = []
        self.warnings = []
        
    def extract_text_from_docx(self, docx_path: str) -> str:
        """Extract text from Word document using pandoc"""
        try:
            result = subprocess.run(
                ['pandoc', docx_path, '-o', '-', '--to=markdown'],
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to extract text from {docx_path}: {e.stderr}")
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove bold markers
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        
        # Fix escaped quotes
        text = text.replace("\\'", "'")
        
        # Clean up markdown link formatting
        text = re.sub(r'\[([^\]]+)\]\{\.underline\}', r'\1', text)
        
        # Clean up extra whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        
        return text
    
    def parse_markdown(self, markdown_text: str) -> List[Dict]:
        """Parse markdown into structured daily entries"""
        # Split by day markers - handle both [Day N]{.mark} and **Day N** formats
        # Pattern explanation:
        # \*\* - opening bold markers
        # \s* - optional whitespace
        # \[? - optional opening bracket
        # Day\s+ - "Day" followed by whitespace
        # (\d+) - capture the day number
        # \]? - optional closing bracket
        # (?:\{\.mark\})? - optional {.mark} (non-capturing)
        # \s* - optional whitespace
        # \*\* - closing bold markers
        day_pattern = r'\*\*\s*\[?Day\s+(\d+)\]?(?:\{\.mark\})?\s*\*\*'
        sections = re.split(day_pattern, markdown_text, flags=re.IGNORECASE)
        
        entries = []
        
        # Process pairs of (day_number, content)
        for i in range(1, len(sections), 2):
            if i + 1 > len(sections):
                break
                
            day_num = int(sections[i])
            content = sections[i + 1].strip()
            
            try:
                entry = self.parse_day_content(day_num, content)
                entries.append(entry)
            except Exception as e:
                self.issues.append(f"Day {day_num}: Failed to parse - {str(e)}")
                
        return entries
    
    def parse_day_content(self, day_num: int, content: str) -> Dict:
        """Parse a single day's content into structured data"""
        
        entry = {
            'day': day_num,
            'title': '',
            'study_text': '',
            'scripture_ref': '',
            'scripture_text': '',
            'devotional': '',
            'prayer': '',
            'bible_reading': ''
        }
        
        # Split into paragraphs (bold blocks)
        paragraphs = re.split(r'\n\n+', content)
        
        current_section = 'title'
        scripture_parts = []
        devotional_parts = []
        
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # Remove bold markers for comparison
            para_clean = re.sub(r'\*\*([^*]+)\*\*', r'\1', para)
            para_upper = para_clean.upper()
            
            # Detect section headers
            if para_upper == 'STUDY TEXT':
                current_section = 'study_text'
                continue
                
            elif para_upper.startswith('PRAYER'):
                current_section = 'prayer'
                # Extract prayer text after colon
                if ':' in para_clean:
                    prayer_text = para_clean.split(':', 1)[1].strip()
                    entry['prayer'] = prayer_text.lstrip('- ')
                continue
                
            elif 'BIBLE IN A YEAR' in para_upper:
                # Extract reading plan
                match = re.search(r'(Genesis|Exodus|Leviticus|Numbers|Deuteronomy).*', para_clean, re.IGNORECASE)
                if match:
                    entry['bible_reading'] = match.group(0)
                continue
            
            # Process content based on current section
            if current_section == 'title' and not entry['title']:
                entry['title'] = para_clean
                current_section = 'pre_scripture'
                
            elif current_section == 'study_text':
                # Check if it's a scripture reference
                if re.match(r'^[A-Za-z\s]+ \d+:\d+', para_clean):
                    entry['scripture_ref'] = para_clean
                    current_section = 'scripture'
                    
            elif current_section == 'scripture':
                # Scripture text typically starts with quotes
                scripture_parts.append(para_clean)
                # If we hit content that doesn't look like scripture, transition
                if not (para_clean.startswith("'") or para_clean.startswith('"') or 
                       any(para_clean.startswith(s) for s in scripture_parts[:-1])):
                    # Last item might be start of devotional
                    if len(scripture_parts) > 1:
                        entry['scripture_text'] = '\n\n'.join(scripture_parts[:-1])
                        devotional_parts.append(scripture_parts[-1])
                    current_section = 'devotional'
                    
            elif current_section == 'devotional':
                devotional_parts.append(para_clean)
                
            elif current_section == 'pre_scripture':
                # Content before scripture (likely still title or intro)
                if re.match(r'^[A-Za-z\s]+ \d+:\d+', para_clean):
                    entry['scripture_ref'] = para_clean
                    current_section = 'scripture'
        
        # Finalize scripture if we ended in that section
        if current_section == 'scripture' and scripture_parts:
            entry['scripture_text'] = '\n\n'.join(scripture_parts)
        
        # Clean and join devotional parts
        if devotional_parts:
            entry['devotional'] = '\n\n'.join(devotional_parts)
        
        # Clean up scripture text (remove quotes)
        if entry['scripture_text']:
            entry['scripture_text'] = entry['scripture_text'].strip("'\"")
        
        # Validate entry
        self.validate_entry(entry)
        
        return entry
    
    def validate_entry(self, entry: Dict) -> None:
        """Validate that entry has required fields"""
        day = entry['day']
        
        if not entry['title']:
            self.issues.append(f"Day {day}: Missing title")
        
        if not entry['devotional']:
            self.warnings.append(f"Day {day}: Missing devotional content")
        
        if not entry['scripture_ref']:
            self.warnings.append(f"Day {day}: Missing scripture reference")
        
        if len(entry['devotional']) < 100:
            self.warnings.append(f"Day {day}: Devotional content seems very short")
    
    def generate_html_for_day(self, entry: Dict) -> str:
        """Generate clean HTML for a day's content"""
        html_parts = []
        
        if entry['title']:
            html_parts.append(f'<h2 class="thought-title">{html.escape(entry["title"])}</h2>')
        
        if entry['scripture_ref']:
            html_parts.append(f'<div class="scripture-ref">{html.escape(entry["scripture_ref"])}</div>')
        
        if entry['scripture_text']:
            scripture = entry['scripture_text'].strip("'\"")
            # Convert paragraphs
            paragraphs = scripture.split('\n\n')
            scripture_html = ''.join(f'<p>{html.escape(p)}</p>' for p in paragraphs if p.strip())
            html_parts.append(f'<div class="scripture-text">{scripture_html}</div>')
        
        if entry['devotional']:
            # Convert paragraphs
            paragraphs = entry['devotional'].split('\n\n')
            devotional_html = ''.join(f'<p>{html.escape(p)}</p>' for p in paragraphs if p.strip())
            html_parts.append(f'<div class="devotional">{devotional_html}</div>')
        
        if entry['prayer']:
            prayer = entry['prayer'].replace(':-', ':').strip()
            html_parts.append(f'<div class="prayer"><strong>Prayer:</strong> {html.escape(prayer)}</div>')
        
        return '\n'.join(html_parts)
    
    def process_file(self, input_path: str, output_dir: str) -> Tuple[List[Dict], str]:
        """Main processing pipeline"""
        print(f"📖 Extracting text from {input_path}...")
        markdown = self.extract_text_from_docx(input_path)
        
        print("📝 Parsing entries...")
        entries = self.parse_markdown(markdown)  # Parse BEFORE cleaning
        
        print("🧹 Cleaning parsed content...")
        # Clean individual fields in each entry
        for entry in entries:
            entry['title'] = self.clean_text(entry['title'])
            entry['scripture_ref'] = self.clean_text(entry['scripture_ref'])
            entry['scripture_text'] = self.clean_text(entry['scripture_text'])
            entry['devotional'] = self.clean_text(entry['devotional'])
            entry['prayer'] = self.clean_text(entry['prayer'])
            entry['bible_reading'] = self.clean_text(entry['bible_reading'])
        
        print(f"✨ Processed {len(entries)} days")
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate individual JSON files
        print("💾 Writing individual day files...")
        for entry in entries:
            day_num = entry['day']
            entry_with_html = entry.copy()
            entry_with_html['html'] = self.generate_html_for_day(entry)
            
            day_file = output_path / f'day-{day_num:03d}.json'
            with open(day_file, 'w', encoding='utf-8') as f:
                json.dump(entry_with_html, f, indent=2, ensure_ascii=False)
        
        # Generate master index
        print("📋 Creating index...")
        index = {
            'generated': datetime.now().isoformat(),
            'total_days': len(entries),
            'days': [
                {
                    'day': e['day'],
                    'title': e['title'],
                    'scripture_ref': e['scripture_ref']
                }
                for e in entries
            ]
        }
        
        index_file = output_path / 'index.json'
        with open(index_file, 'w', encoding='utf-8') as f:
            json.dump(index, f, indent=2, ensure_ascii=False)
        
        # Generate validation report
        report = self.generate_report(entries)
        report_file = output_path / 'validation_report.txt'
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"\n✅ Complete! Output written to {output_dir}")
        print(f"📊 Validation report: {report_file}")
        
        return entries, report
    
    def generate_report(self, entries: List[Dict]) -> str:
        """Generate a validation report"""
        report_lines = [
            "=" * 70,
            "THOUGHT FOR THE DAY - VALIDATION REPORT",
            "=" * 70,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Days Processed: {len(entries)}",
            "",
        ]
        
        if self.issues:
            report_lines.extend([
                "🔴 ISSUES (require attention):",
                "-" * 70,
            ])
            for issue in self.issues:
                report_lines.append(f"  • {issue}")
            report_lines.append("")
        
        if self.warnings:
            report_lines.extend([
                "⚠️  WARNINGS (review recommended):",
                "-" * 70,
            ])
            for warning in self.warnings:
                report_lines.append(f"  • {warning}")
            report_lines.append("")
        
        if not self.issues and not self.warnings:
            report_lines.append("✅ No issues found! All entries validated successfully.")
        
        report_lines.extend([
            "",
            "=" * 70,
            "SUMMARY BY DAY:",
            "=" * 70,
        ])
        
        for entry in entries:
            day = entry['day']
            title = entry['title'][:50] + ('...' if len(entry['title']) > 50 else '')
            content_len = len(entry['devotional'])
            report_lines.append(f"Day {day:3d}: {title:50s} ({content_len:4d} chars)")
        
        return '\n'.join(report_lines)


def main():
    if len(sys.argv) < 3:
        print("Usage: python prepare_thoughts.py <input.docx> <output_directory>")
        print("\nExample:")
        print("  python prepare_thoughts.py devotional.docx data/thoughts/")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_dir = sys.argv[2]
    
    if not Path(input_file).exists():
        print(f"❌ Error: Input file not found: {input_file}")
        sys.exit(1)
    
    processor = ThoughtProcessor()
    
    try:
        entries, report = processor.process_file(input_file, output_dir)
        print("\n" + report)
        
        if processor.issues:
            print(f"\n⚠️  Found {len(processor.issues)} issues - please review the validation report")
            sys.exit(1)
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
