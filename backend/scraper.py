#!/usr/bin/env python3
import json
import os
import re
import time
import argparse
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple
import html
import unicodedata
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE = "https://outlands.uorazorscripts.com"
LIST_URL = f"{BASE}/scripts"
DEFAULT_OUTPUT_JSONL = "outlands_scripts.jsonl"
DEFAULT_VISITED_CACHE = "visited_urls.txt"
SCROLL_PAUSE_SEC = 0.75
NAV_PAUSE_SEC = 0.3
TIMEOUT_MS = 20000

LINE_NO_COL = re.compile(r"^\s*(\d{1,6})(?:\s{0,3})")

CODE_TOKENS = (
    "@setvar", "@setvar!", "endif", "endwhile", "gumpresponse", "ingump",
    "while ", "elseif", "sysmsg", "overhead", "useskill", "waitforgump",
    "target", "lift ", "drop ", "dclick", "hotkey", "if ", "foreach", "endfor",
    "//", "#"
)

CHROME_START_PATTERNS = (
    "related:", "created:", "last updated:", "view change history",
    "copy script", "copy url", "download script"
)
# expand these near your dechrome helper
CHROME_ANYWHERE_PATTERNS = (
    "quick links",   # <- keep generic (no colon) to survive emojis/punctuation
    "quick filters",
    "copy script", "copy url", "download script",
    "view change history", "created:", "last updated:",
    "check out uoaddicts.com"
)
SITE_CHROME_PATTERNS = [
    r"^Quick links:.*",
    r"^View Change History.*",
    r"^Copy (Script|URL).*",
    r"^Download Script.*",
    r"^Related:.*",
]

def scrape_urls(page, to_visit, out_path, visited_path, flush_every, nav_pause=0.3):
    """
    Visit each script URL, extract details, flush in batches, and ALWAYS
    persist any remaining buffer in a finally block.

    - Marks deleted pages as visited and skips them.
    - Also marks empty-but-not-deleted pages as visited to avoid re-hits.
    """
    buffer = []
    try:
        for idx, url in enumerate(to_visit, 1):
            try:
                page.goto(url)
                time.sleep(nav_pause)

                rec = extract_detail(page, url)

                # Deleted/tombstoned → skip but mark visited
                if rec.get("deleted"):
                    print(f"    [-] Deleted/tombstone: {url}")
                    append_visited(str(visited_path), url)
                    continue

                # Mark visited for any successfully parsed page
                append_visited(str(visited_path), url)

                # Minimal sanity for saving
                if rec.get("code") or rec.get("title"):
                    buffer.append(rec)
                    if len(buffer) >= flush_every:
                        save_jsonl(buffer, str(out_path))
                        print(f"    [+] Saved {len(buffer)} record(s) (up to #{idx})")
                        buffer.clear()

                time.sleep(0.25)

            except PWTimeout:
                print(f"    [!] Timeout on {url}, skipping.")
            except Exception as e:
                print(f"    [!] Error on {url}: {e}")

    finally:
        if buffer:
            save_jsonl(buffer, str(out_path))
            print(f"[+] Saved final {len(buffer)} record(s).")
            
def strip_site_chrome(code: str) -> str:
    lines = code.splitlines()
    out = []
    for ln in lines:
        if any(re.search(p, ln, re.IGNORECASE) for p in SITE_CHROME_PATTERNS):
            continue
        out.append(ln)
    # hard cut if "Quick links:" appears mid-block
    joined = "\n".join(out)
    if "Quick links:" in joined:
        joined = joined.split("Quick links:", 1)[0].rstrip()
    return joined.strip("\n")

def is_chrome_line(ln: str) -> bool:
    low = ln.strip().lower()
    return any(p in low for p in CHROME_ANYWHERE_PATTERNS)

def normalize_text(s: str) -> str:
    s = html.unescape(s or "")
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("\r\n", "\n")
    return "\n".join(ln.rstrip() for ln in s.splitlines())

def dechrome_and_clip(text: str) -> str:
    """
    Drop site chrome (headers/footers) and keep the main code.
    - Remove known chrome lines anywhere.
    - Clip to the first/last lines that look like code.
    """
    if not text:
        return text

    lines = [ln.rstrip() for ln in text.splitlines()]

    # remove obvious chrome anywhere
    def is_chrome_line(ln: str) -> bool:
        low = ln.strip().lower()
        if any(low.startswith(p) for p in CHROME_START_PATTERNS):
            return True
        if any(p in low for p in CHROME_ANYWHERE_PATTERNS):
            return True
        return False

    lines = [ln for ln in lines if not is_chrome_line(ln)]

    # find first/last "codey" line
    def looks_codey(ln: str) -> bool:
        low = ln.lstrip().lower()
        return any(tok in low for tok in CODE_TOKENS)

    first = next((i for i, ln in enumerate(lines) if looks_codey(ln)), None)
    last  = next((i for i in range(len(lines)-1, -1, -1) if looks_codey(lines[i])), None)

    if first is not None and last is not None and first <= last:
        lines = lines[first:last+1]

    return "\n".join(lines).strip("\n")

def strip_line_number_column(text: str) -> str:
    """
    Remove a left-hand line-number column if most lines are numbered.
    Works whether the site inserts a space (e.g., '72    while') or not (e.g., '72while').
    """
    lines = text.splitlines()
    if not lines:
        return text

    hits, nums, stripped = 0, [], []
    for ln in lines:
        m = LINE_NO_COL.match(ln)
        if m:
            # Heuristic: treat as a line-number when (a) many lines look like this
            # We'll verify globally with the 60% rule below.
            hits += 1
            try:
                nums.append(int(m.group(1)))
            except Exception:
                pass
            stripped.append(ln[m.end():])  # remove the number (and optional spaces)
        else:
            stripped.append(ln)

    # require >=60% lines numbered and roughly non-decreasing to avoid false positives
    if hits / len(lines) >= 0.6 and len(nums) >= 5:
        inc_ok, last = 0, None
        for n in nums:
            if last is None or n >= last:
                inc_ok += 1
            last = n
        if inc_ok >= int(len(nums) * 0.6):
            return "\n".join(s.rstrip() for s in stripped).strip("\n")

    return text

def looks_deleted_text(text: str) -> bool:
    if not text:
        return False
    lines = [ln.strip().lower() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return False
    return all(ln in ("deleted.", "deleted") for ln in lines) and len(lines) <= 5

def text_or_none(locator) -> Optional[str]:
    try:
        t = locator.inner_text().strip()
        return t if t else None
    except Exception:
        return None

def get_script_links(page) -> List[str]:
    anchors = page.locator('a[href^="/script/"]')
    hrefs = set()
    try:
        count = anchors.count()
    except PWTimeout:
        count = 0
    for i in range(count):
        try:
            href = anchors.nth(i).get_attribute("href")
            if href and href.startswith("/script/"):
                hrefs.add(BASE + href)
        except Exception:
            continue
    return sorted(hrefs)

def infinite_scroll_all(page, hard_cap: Optional[int] = None):
    same_rounds = 0
    max_same_rounds = 5  # Increased from 3 to 5
    while True:
        before = len(get_script_links(page))
        if hard_cap and before >= hard_cap:
            break
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(SCROLL_PAUSE_SEC * 2)  # Increased wait time
        after = len(get_script_links(page))
        print(f"[+] Scrolled: {before} → {after} links")
        if after == before:
            same_rounds += 1
            if same_rounds >= max_same_rounds:
                print(f"[+] Stopping after {max_same_rounds} rounds with no new content")
                break
        else:
            same_rounds = 0
    return get_script_links(page)

def parse_title_author(raw_title: str) -> Tuple[str, Optional[str]]:
    if not raw_title:
        return ("", None)
    parts = raw_title.split(" by ")
    if len(parts) >= 2:
        title = " by ".join(parts[:-1]).strip()
        author = parts[-1].strip()
        return (title, author if author else None)
    return (raw_title.strip(), None)

def get_biggest_code_block(page) -> str:
    """Prefer <pre><code>, then <pre>, then long codey text under main/article."""
    try:
        # short wait helps when the highlighter paints a moment later
        page.wait_for_selector("pre, pre code", timeout=1500)
    except Exception:
        pass
    candidates = []

    # 1) <pre><code>
    blocks = page.locator("pre code")
    for i in range(blocks.count()):
        try:
            t = blocks.nth(i).text_content()
        except Exception:
            t = None
        if t and t.count("\n") >= 3:
            candidates.append(t)

    # 2) <pre>
    blocks = page.locator("pre")
    for i in range(blocks.count()):
        try:
            t = blocks.nth(i).text_content()
        except Exception:
            t = None
        if t and t.count("\n") >= 3:
            candidates.append(t)

    # 3) long-ish text that looks like macro code (fallback)
    for sel in ["main", "article"]:
        nodes = page.locator(sel)
        if nodes.count() == 0:
            continue
        try:
            t = nodes.first.text_content()
        except Exception:
            t = None
        if t and t.count("\n") >= 10 and any(k in t for k in ["@setvar", "endif", "endwhile", "gumpresponse", "ingump", "while "]):
            candidates.append(t)

    if not candidates:
        return ""
    return max(candidates, key=len)

def load_visited(path: str) -> Set[str]:
    if not os.path.exists(path):
        return set()
    with open(path, "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())

def append_visited(path: str, url: str):
    with open(path, "a", encoding="utf-8") as f:
        f.write(url + "\n")

def load_urls_from_jsonl(path: str) -> Set[str]:
    if not os.path.exists(path):
        return set()
    urls = set()
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
                u = rec.get("url")
                if u:
                    urls.add(u)
            except Exception:
                pass
    return urls

def save_jsonl(records: List[Dict], path: str):
    with open(path, "a", encoding="utf-8") as f:
        for rec in records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")

def is_deleted_block(code: str) -> bool:
    txt = (code or "").strip().lower()
    if not txt:
        return False
    # keep it tight: 1–5 short lines all saying "deleted" (with/without period)
    lines = [ln.strip().lower() for ln in txt.splitlines() if ln.strip()]
    return 0 < len(lines) <= 5 and all(re.fullmatch(r"deleted\.?", ln) for ln in lines)

def extract_detail(page, url: str) -> Dict:
    # title/author
    title_el = page.locator("h1, h2").first
    raw_title = text_or_none(title_el) or ""
    title, author_from_title = parse_title_author(raw_title)

    author_link = page.locator('a[href^="/user/"]').first
    author = text_or_none(author_link) or author_from_title

    # category & tags
    skill_links = page.locator('a[href^="/skills/"]')
    tag_links = page.locator('a[href^="/tags/"]')
    category = text_or_none(skill_links.first) if skill_links.count() > 0 else None

    tags = []
    for i in range(tag_links.count()):
        t = text_or_none(tag_links.nth(i))
        if t:
            tags.append(t)
    # de-dupe
    seen = set()
    tags = [t for t in tags if not (t in seen or seen.add(t))]

    # description (first small sibling after label)
    description = ""
    desc_label = page.locator("text=Description from the author,Description from the author:").first
    if desc_label.count() > 0:
        try:
            parent = desc_label.locator("xpath=..")
            sib = parent.locator("xpath=following-sibling::*[1]")
            if sib.count() > 0:
                tag = sib.evaluate("el => el.tagName.toLowerCase()")
                if tag not in ("pre", "code"):
                    dtext = sib.text_content().strip()
                    if 0 < len(dtext) < 2000:
                        description = dtext
        except Exception:
            pass

    # code (normalize + strip line numbers)
    raw_code = get_biggest_code_block(page)
    code = normalize_text(raw_code)
    code = strip_line_number_column(code)
    code = strip_site_chrome(code)
    code = dechrome_and_clip(code)
    deleted = is_deleted_block(code)
    if deleted:
        code = ""  # normalize to empty; we'll skip saving later

    # deletion heuristic (some pages are just "deleted.")
    body_text = ""
    try:
        body_text = page.locator("main").inner_text()
    except Exception:
        try:
            body_text = page.locator("body").inner_text()
        except Exception:
            body_text = ""
    deleted_flag = looks_deleted_text(code) or looks_deleted_text(body_text)

    # fallback if still empty and not deleted
    if not code and not deleted_flag:
        try:
            all_text = page.locator("body").inner_text()
            if "Description from the author" in all_text:
                fallback = all_text.split("Description from the author", 1)[-1]
                fallback = normalize_text(fallback)
                code = strip_line_number_column(fallback)
        except Exception:
            pass

    return {
        "title": title or None,
        "author": author or None,
        "category": category or None,
        "tags": tags or [],
        "description": description or "",
        "code": code or "",
        "url": url,
        "deleted": deleted,
    }

def main():
    ap = argparse.ArgumentParser(description="Scrape UO Outlands Razor scripts into JSONL.")
    ap.add_argument("--out", default=DEFAULT_OUTPUT_JSONL, help="Output JSONL path")
    ap.add_argument("--visited", default=DEFAULT_VISITED_CACHE, help="Visited URL cache path")
    ap.add_argument("--limit", type=int, default=0, help="Max scripts to fetch (0 = all)")
    ap.add_argument("--headful", action="store_true", help="Run browser non-headless")
    ap.add_argument("--no-cache", action="store_true", help="Ignore visited cache (still writes new visits)")
    ap.add_argument("--flush-every", type=int, default=1, help="Write to JSONL after N records (1 = immediate)")
    args = ap.parse_args()

    out_path = Path(args.out)
    visited_path = Path(args.visited)

    # Ensure dirs exist
    out_path.parent.mkdir(parents=True, exist_ok=True)
    visited_path.parent.mkdir(parents=True, exist_ok=True)

    visited = set() if args.no_cache else load_visited(str(visited_path))
    already_in_jsonl = load_urls_from_jsonl(str(out_path))
    skip_urls = visited | already_in_jsonl

    print(f"[+] Loaded {len(visited)} visited URLs")
    print(f"[+] Found {len(already_in_jsonl)} URLs in existing JSONL")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headful)
        try:
            context = browser.new_context(
                user_agent="Mozilla/5.0 (compatible; OutlandsScraper/1.2)"
            )
            page = context.new_page()
            page.set_default_timeout(TIMEOUT_MS)

            print(f"[+] Opening list: {LIST_URL}")
            page.goto(LIST_URL)
            time.sleep(NAV_PAUSE_SEC)

            hard_cap = args.limit if args.limit and args.limit > 0 else None
            print("[+] Scrolling until scripts are loaded (or limit reached)...")
            all_links = infinite_scroll_all(page, hard_cap=hard_cap)
            print(f"[+] Found {len(all_links)} script links.")

            to_visit = [u for u in all_links if u not in skip_urls]
            print(f"[+] New links to visit: {len(to_visit)}")

            scrape_urls(page, to_visit, out_path, visited_path, args.flush_every, NAV_PAUSE_SEC)
        finally:
            browser.close()


if __name__ == "__main__":
    main()
