#!/usr/bin/env python3
"""Generate spoken-word MP3s for each day's devotional using edge-tts.

Reads data/day-NNN.json, builds clean spoken text from the structured
fields (title, scripture, devotional, prayer — the bible-in-a-year plan
line is skipped as it reads awkwardly aloud), and writes
data/audio/day-NNN.mp3 with the en-GB-RyanNeural voice.

Idempotent: existing non-empty MP3s are skipped, so it can be re-run
whenever new day JSONs are added.

Usage:
    python3 generate_audio.py            # all days missing an mp3
    python3 generate_audio.py 186        # just day 186
"""

import asyncio
import html
import io
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

import edge_tts

VOICE = "en-GB-RyanNeural"
ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
AUDIO = DATA / "audio"
RETRIES = 4


class _TextExtractor(HTMLParser):
    """Collect text content; treat block-level closes as paragraph breaks."""

    BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "li", "br"}

    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_endtag(self, tag):
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_startendtag(self, tag, attrs):
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")


def strip_html(fragment):
    extractor = _TextExtractor()
    extractor.feed(html.unescape(fragment))
    return "".join(extractor.parts)


def clean(text):
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text)
    return text.strip()


def spoken_text(day):
    parts = [clean(day.get("title", ""))]
    ref = clean(day.get("scripture_ref", ""))
    scripture = clean(strip_html(day.get("scripture_text", "")))
    if ref:
        parts.append(f"Study text: {ref}.")
    if scripture:
        parts.append(scripture)
    parts.append(clean(strip_html(day.get("devotional", ""))))
    prayer = clean(strip_html(day.get("prayer", "")))
    if prayer:
        parts.append(f"Prayer. {prayer}")
    return "\n\n".join(p for p in parts if p)


async def synthesize(text, outfile):
    for attempt in range(1, RETRIES + 1):
        try:
            buf = io.BytesIO()
            communicate = edge_tts.Communicate(text, VOICE)
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            if buf.tell() == 0:
                raise RuntimeError("no audio returned")
            outfile.write_bytes(buf.getvalue())
            return
        except Exception as exc:
            if attempt == RETRIES:
                raise
            wait = 5 * attempt
            print(f"  retry {attempt} after error: {exc} (waiting {wait}s)")
            await asyncio.sleep(wait)


async def main():
    AUDIO.mkdir(exist_ok=True)
    if len(sys.argv) > 1:
        day_files = [DATA / f"day-{int(a):03d}.json" for a in sys.argv[1:]]
    else:
        day_files = sorted(DATA.glob("day-*.json"))

    done = skipped = 0
    for day_file in day_files:
        out = AUDIO / (day_file.stem + ".mp3")
        if out.exists() and out.stat().st_size > 0:
            skipped += 1
            continue
        day = json.loads(day_file.read_text())
        text = spoken_text(day)
        await synthesize(text, out)
        done += 1
        print(f"{out.name}  {out.stat().st_size // 1024} KB  ({len(text)} chars)")
        await asyncio.sleep(1)  # be polite to the free endpoint

    print(f"generated {done}, skipped {skipped} already present")


if __name__ == "__main__":
    asyncio.run(main())
