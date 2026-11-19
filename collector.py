#!/usr/bin/env python3
"""IMO / 기국 공지 수집기. 표준 라이브러리만 사용 (pip 설치 불필요).

실행: python3 collector.py
결과: docs/data/items.json
"""
import datetime as dt
import hashlib
import json
import pathlib
import re
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent
SOURCES = ROOT / "sources.json"
OUT = ROOT / "docs" / "data" / "items.json"
MAX_ITEMS = 500
UA = "Mozilla/5.0 (compatible; IMO-Watch/0.1; +personal use)"

# 고우선순위 키워드 (SOLAS, MARPOL 등)
HIGH = re.compile(
    r"SOLAS|MARPOL|URGENT|EMERGENC|IMMEDIATE|DETENTION|MANDATORY|PIRACY|SANCTION",
    re.I,
)
# 공지성 링크만 남기기 위한 필터
RELEVANT = re.compile(
    r"notice|circular|advisor|bulletin|resolution|press|guidance|IMO|SOLAS|MARPOL|note",
    re.I,
)


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self._href = None
        self._buf = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._buf = []

    def handle_data(self, data):
        if self._href is not None:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href:
            text = " ".join(" ".join(self._buf).split())
            self.links.append((self._href, text))
            self._href = None


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def collect_source(src: dict, now: str) -> list[dict]:
    html = fetch(src["url"])
    parser = LinkParser()
    parser.feed(html)

    needle = src.get("link_contains", "").lower()
    items, seen = [], set()
    for href, text in parser.links:
        url = urllib.parse.urljoin(src["url"], href)
        if needle and needle not in url.lower():
            continue
        if len(text) < 8 or not RELEVANT.search(text):
            continue
        if url in seen:
            continue
        seen.add(url)
        items.append({
            "id": hashlib.sha1(url.encode()).hexdigest()[:16],
            "source": src["id"],
            "flag": src["flag"],
            "title": text,
            "url": url,
            "priority": "high" if HIGH.search(text) else "normal",
            "first_seen": now,
        })
    return items


def main() -> int:
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    sources = json.loads(SOURCES.read_text(encoding="utf-8"))

    existing = {}
    if OUT.exists():
        for it in json.loads(OUT.read_text(encoding="utf-8")).get("items", []):
            existing[it["id"]] = it

    errors, fresh = {}, []
    for src in sources:
        if not src.get("enabled") or not src.get("url"):
            continue
        try:
            fresh.extend(collect_source(src, now))
        except Exception as exc:  # 한 소스 실패가 전체를 막지 않도록
            errors[src["id"]] = str(exc)[:200]

    new_ids = []
    for it in fresh:
        if it["id"] in existing:
            # 기존 항목은 최초 발견 시각과 우선순위 정보를 유지
            existing[it["id"]]["title"] = it["title"]
            existing[it["id"]]["priority"] = it["priority"]
        else:
            existing[it["id"]] = it
            new_ids.append(it["id"])

    items = sorted(existing.values(), key=lambda x: x["first_seen"], reverse=True)[:MAX_ITEMS]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps({"generated_at": now, "errors": errors, "new_ids": new_ids, "items": items},
                   ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"신규 {len(new_ids)}건, 전체 {len(items)}건, 오류 {len(errors)}건")
    for sid, msg in errors.items():
        print(f"  [오류] {sid}: {msg}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
