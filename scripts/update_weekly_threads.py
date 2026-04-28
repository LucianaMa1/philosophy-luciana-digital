#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / 'site' / 'data'
AUTHORS_PATH = DATA_DIR / 'authors.json'
THREADS_PATH = DATA_DIR / 'threads.json'
METADATA_PATH = DATA_DIR / 'site-metadata.json'

KEYWORD_TAGS = {
    'payment': 'institutions',
    'payments': 'institutions',
    'fraud': 'honesty',
    'institution': 'institutions',
    'regulation': 'coordination',
    'law': 'coordination',
    'interface': 'agency',
    'work': 'leverage',
    'career': 'meaning',
    'model': 'agency',
    'agent': 'agency',
    'ethic': 'care',
    'align': 'judgment',
    'honest': 'honesty',
    'learn': 'judgment',
    'incentive': 'incentives',
    'trust': 'honesty',
    'risk': 'care',
}

FEED_SOURCE_LABELS = {
    'Amanda Askell': "Amanda Askell's Blog",
    'Ethan Mollick': 'One Useful Thing',
    'Patrick McKenzie': 'Bits about Money',
    'Shreyas Doshi': 'Shreyas Doshi',
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text())


def dump_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')


def strip_html(raw: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', raw or '')
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def slugify(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')


def fetch_feed(url: str) -> ET.Element:
    request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Hermes weekly curator)'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return ET.fromstring(response.read())


def parse_items(root: ET.Element, limit: int = 2) -> list[dict[str, Any]]:
    items = []
    for item in root.findall('./channel/item')[:limit]:
        title = (item.findtext('title') or '').strip()
        link = (item.findtext('link') or '').strip()
        description = strip_html(item.findtext('description') or '')
        pub = (item.findtext('pubDate') or '').strip()
        published = parsedate_to_datetime(pub).astimezone(timezone.utc) if pub else datetime.now(timezone.utc)
        items.append({
            'title': title,
            'link': link,
            'description': description,
            'published_at': published,
        })
    return items


def infer_tags(text: str, author_terms: list[str]) -> list[str]:
    tags = []
    lowered = text.lower()
    for keyword, tag in KEYWORD_TAGS.items():
        if keyword in lowered and tag not in tags:
            tags.append(tag)
    for term in author_terms:
        if term not in tags:
            tags.append(term)
        if len(tags) >= 3:
            break
    return tags[:3] or author_terms[:3]


def build_thread_fragments(title: str, description: str, reason: str) -> list[str]:
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', description) if s.strip()]
    fragments = []
    if title:
        fragments.append(f'This week\'s source title: {title}.')
    fragments.extend(sentences[:2])
    fragments.append(reason)
    deduped = []
    for fragment in fragments:
        if fragment and fragment not in deduped:
            deduped.append(fragment)
    return deduped[:3]


def freshness_label(published_at: datetime) -> str:
    age_days = (datetime.now(timezone.utc) - published_at).days
    if age_days <= 21:
        return 'fresh'
    if age_days <= 120:
        return 'active'
    return 'archive, still canonical'


def main() -> None:
    authors = load_json(AUTHORS_PATH)
    manual_threads = [t for t in load_json(THREADS_PATH) if t.get('source_mode') == 'manual']
    generated_threads = []

    for author in authors:
        if author['mode'] != 'feed':
            continue
        root = fetch_feed(author['source_url'])
        for item in parse_items(root, limit=2):
            text_for_tags = ' '.join([item['title'], item['description'], ' '.join(author['signature_terms'])])
            generated_threads.append({
                'id': f"{author['slug']}-{slugify(item['title'])}",
                'author': author['name'],
                'author_url': author['homepage'],
                'source_label': FEED_SOURCE_LABELS.get(author['name'], author['name']),
                'published_at': item['published_at'].replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
                'title': item['title'],
                'url': item['link'],
                'excerpt': item['description'][:220] + ('…' if len(item['description']) > 220 else ''),
                'signal_status': freshness_label(item['published_at']),
                'lexicon': infer_tags(text_for_tags, author['signature_terms']),
                'thread': build_thread_fragments(item['title'], item['description'], author['reason_to_watch']),
            })

    threads = sorted(generated_threads + manual_threads, key=lambda t: t['published_at'], reverse=True)
    dump_json(THREADS_PATH, threads)

    metadata = load_json(METADATA_PATH)
    metadata['last_updated'] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    metadata['total_threads'] = len(threads)
    metadata['feed_backed_authors'] = sum(1 for a in authors if a['mode'] == 'feed')
    metadata['watchlist_only_authors'] = sum(1 for a in authors if a['mode'] != 'feed')
    dump_json(METADATA_PATH, metadata)

    print(f'Updated {len(threads)} thread cards across {metadata["feed_backed_authors"]} feed-backed authors.')


if __name__ == '__main__':
    main()
