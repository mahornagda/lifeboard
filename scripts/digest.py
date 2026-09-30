#!/usr/bin/env python3
"""Builds data/digest.json for the Digest view. Runs on a schedule in GitHub Actions (stdlib only).

- RBI press releases whose title contains "Directions" (name, date, link, PDF).
- Merriam-Webster word of the day (word, date, link, short definition, example).

History ACCUMULATES: each run merges into the existing file, so nothing drops off when the
source pages move on. A source that fails keeps its old data; the run still succeeds.
"""
import html
import http.cookiejar
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'data' / 'digest.json'
STATUS = OUT.with_name('status.json')
RBI_URL = 'https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx'
RBI_BASE = 'https://www.rbi.org.in/Scripts/'
WOTD_FEED = 'https://www.merriam-webster.com/wotd/feed/rss2'
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9'}
IST = timezone(timedelta(hours=5, minutes=30))
MONTHS = {m: i for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 1)}
DIRECTIONS = re.compile(r'\bdirections\b', re.I)


def clean(text):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', text or ''))).strip()


# ---------- RBI ----------
def parse_rbi(page):
    """Walk the page in order: a date header sets the date for the release rows under it."""
    out, current = [], None
    pattern = re.compile(
        r'class="tableheader"[^>]*><b>([A-Z][a-z]{2}) (\d{1,2}), (\d{4})'
        r"|href=BS_PressReleaseDisplay\.aspx\?prid=(\d+)>(.*?)</a>(.*?)</tr>", re.S)
    for m in pattern.finditer(page):
        if m.group(1):
            current = f'{m.group(3)}-{MONTHS[m.group(1)]:02d}-{int(m.group(2)):02d}'
            continue
        title = clean(m.group(5))
        if not current or not DIRECTIONS.search(title):
            continue
        pdf = re.search(r"href='(https://rbidocs\.rbi\.org\.in/[^']+\.PDF)'", m.group(6), re.I)
        out.append({'id': int(m.group(4)), 'title': title, 'date': current,
                    'url': f'{RBI_BASE}BS_PressReleaseDisplay.aspx?prid={m.group(4)}',
                    'pdf': pdf.group(1) if pdf else None})
    return out


def fetch_rbi(years):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    first = opener.open(urllib.request.Request(RBI_URL, headers=UA), timeout=60).read().decode('utf-8', 'ignore')
    found = parse_rbi(first)
    if 'prid=' not in first:
        raise RuntimeError('RBI page came back without any press releases (blocked?)')
    hidden = {m.group(1): html.unescape(m.group(2))
              for m in re.finditer(r'<input type="hidden" name="([^"]+)" id="[^"]+" value="([^"]*)"', first)}
    for year in years:  # the page's own year picker: hdnMonth=0 means "all months"
        form = {**hidden, 'hdnYear': str(year), 'hdnMonth': '0', '__EVENTTARGET': '', '__EVENTARGUMENT': ''}
        page = opener.open(urllib.request.Request(RBI_URL, data=urllib.parse.urlencode(form).encode(), headers=UA), timeout=90)
        found += parse_rbi(page.read().decode('utf-8', 'ignore'))
    return found


# ---------- Merriam-Webster ----------
def fetch_words():
    raw = urllib.request.urlopen(urllib.request.Request(WOTD_FEED, headers=UA), timeout=60).read()
    root = ET.fromstring(raw)
    words = []
    for item in root.iter('item'):
        link = (item.findtext('link') or '').strip()
        date = re.search(r'(\d{4}-\d{2}-\d{2})$', link)
        if not date:
            continue
        desc = item.findtext('description') or ''
        shortdef = next((c.text for c in item if c.tag.endswith('shortdef')), '') or ''
        pron = re.search(r'\\([^\\]{1,60})\\', desc)
        pos = re.search(r'<em>([a-z ]{3,20})</em><br', desc)
        example = re.search(r'<p>//\s*(.*?)</p>', desc, re.S)
        meaning = re.search(r'</em><br\s*/?>\s*<p>(.*?)</p>', desc, re.S)
        words.append({
            'date': date.group(1), 'word': clean(item.findtext('title')), 'url': link,
            'pronunciation': clean(pron.group(1)) if pron else '',
            'pos': clean(pos.group(1)) if pos else '',
            'definition': clean(shortdef) or (clean(meaning.group(1)) if meaning else ''),
            'example': clean(example.group(1)) if example else '',
        })
    if not words:
        raise RuntimeError('word feed had no items')
    return words


def merge(old, new, key):
    by = {x[key]: x for x in old}
    by.update({x[key]: x for x in new})
    return list(by.values())


def main():
    old = json.loads(OUT.read_text()) if OUT.exists() else {'rbi': [], 'words': []}
    status = {'checkedAt': datetime.now(IST).isoformat(timespec='minutes'), 'errors': {}}
    now = datetime.now(IST)
    years = [now.year - 1, now.year] if now.month == 1 or not old.get('rbi') else [now.year]

    rbi, words = old.get('rbi', []), old.get('words', [])
    try:
        rbi = merge(rbi, fetch_rbi(years), 'id')
    except Exception as err:  # keep yesterday's list rather than an empty one
        status['errors']['rbi'] = str(err)
    try:
        words = merge(words, fetch_words(), 'date')
    except Exception as err:
        status['errors']['words'] = str(err)

    rbi.sort(key=lambda r: (r['date'], r['id']), reverse=True)
    words.sort(key=lambda w: w['date'], reverse=True)
    data = {'rbi': rbi, 'words': words[:800]}
    if data != {'rbi': old.get('rbi', []), 'words': old.get('words', [])}:
        OUT.parent.mkdir(exist_ok=True)
        OUT.write_text(json.dumps({**data, 'updatedAt': status['checkedAt']}, ensure_ascii=False, indent=1))
    STATUS.write_text(json.dumps(status))
    print(f"rbi {len(rbi)} directions, {len(words)} words, errors: {status['errors'] or 'none'}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
