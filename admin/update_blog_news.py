#!/usr/bin/env python3
"""
Miami Alliance 3PL — Daily Blog News Updater
=============================================
Fetches latest logistics/supply chain news from RSS feeds and generates
updated blog.html content.

Usage:
    python3 update_blog_news.py              # Preview mode (dry run)
    python3 update_blog_news.py --apply      # Write to blog.html
    python3 update_blog_news.py --cron       # Non-interactive, auto-apply

RSS Sources:
    - FreightWaves, Supply Chain Dive, Modern Materials Handling
    - Logistics Management, JOC, Supply Chain Brain

Schedule via cron:
    30 8 * * * cd /path/to/admin && python3 update_blog_news.py --cron >> /tmp/blog_update.log 2>&1
"""

import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import json
import os
import sys
import re
import html
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

# ─── Config ──────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
BLOG_HTML = PROJECT_ROOT / "blog.html"

RSS_FEEDS = [
    {
        "url": "https://www.freightwaves.com/feed",
        "name": "FreightWaves",
        "category": "freight"
    },
    {
        "url": "https://www.supplychaindive.com/feeds/news/",
        "name": "Supply Chain Dive",
        "category": "supply-chain"
    },
    {
        "url": "https://www.logisticsmgmt.com/rss",
        "name": "Logistics Management",
        "category": "warehousing"
    },
    {
        "url": "https://www.mmh.com/rss",
        "name": "Modern Materials Handling",
        "category": "technology"
    },
    {
        "url": "https://www.supplychainbrain.com/rss",
        "name": "SupplyChainBrain",
        "category": "supply-chain"
    },
    {
        "url": "https://www.dcvelocity.com/rss/",
        "name": "DC Velocity",
        "category": "warehousing"
    },
    {
        "url": "https://www.americanshipper.com/feed",
        "name": "American Shipper",
        "category": "ports"
    },
    {
        "url": "https://www.ttnews.com/rss.xml",
        "name": "Transport Topics",
        "category": "freight"
    },
]

CATEGORY_TAGS = {
    "freight": ("tag-freight", "Freight"),
    "ports": ("tag-ports", "Ports"),
    "ecommerce": ("tag-ecommerce", "E-Commerce"),
    "supply-chain": ("tag-supply-chain", "Supply Chain"),
    "technology": ("tag-technology", "Technology"),
    "warehousing": ("tag-warehousing", "Warehousing"),
    "3pl": ("tag-3pl", "3PL"),
    "last-mile": ("tag-last-mile", "Last-Mile"),
}

# Keywords for auto-categorization
CATEGORY_KEYWORDS = {
    "freight": ["freight", "trucking", "truckload", "ltl", "carrier", "shipping rate", "drayage"],
    "ports": ["port", "container", "teu", "maritime", "ocean", "vessel"],
    "ecommerce": ["e-commerce", "ecommerce", "amazon", "shopify", "d2c", "online retail", "fulfillment center"],
    "technology": ["robot", "automation", "ai", "artificial intelligence", "drone", "software", "wms", "tms"],
    "warehousing": ["warehouse", "storage", "inventory", "distribution center", "cold chain"],
    "3pl": ["3pl", "third-party logistics", "logistics provider", "outsourc"],
    "last-mile": ["last mile", "last-mile", "delivery", "parcel", "ups", "fedex", "usps"],
}

MAX_ARTICLES = 9
MAX_SUMMARY_LEN = 280

# ─── Helpers ─────────────────────────────────────────────────────────

def fetch_feed(url, timeout=15):
    """Fetch and parse an RSS feed, return list of items."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Miami3PL-BlogBot/1.0"})
        resp = urllib.request.urlopen(req, timeout=timeout)
        data = resp.read()
        root = ET.fromstring(data)

        items = []
        # Handle RSS 2.0
        for item in root.findall(".//item"):
            title = item.findtext("title", "").strip()
            desc = item.findtext("description", "").strip()
            pub_date = item.findtext("pubDate", "").strip()
            link = item.findtext("link", "").strip()

            if title:
                items.append({
                    "title": html.unescape(title),
                    "description": clean_html(html.unescape(desc)),
                    "pub_date": pub_date,
                    "link": link,
                })

        # Handle Atom feeds
        if not items:
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            for entry in root.findall(".//atom:entry", ns):
                title = (entry.findtext("atom:title", "", ns) or "").strip()
                summary = (entry.findtext("atom:summary", "", ns) or
                           entry.findtext("atom:content", "", ns) or "").strip()
                updated = (entry.findtext("atom:updated", "", ns) or
                           entry.findtext("atom:published", "", ns) or "").strip()
                link_el = entry.find("atom:link", ns)
                link = link_el.get("href", "") if link_el is not None else ""

                if title:
                    items.append({
                        "title": html.unescape(title),
                        "description": clean_html(html.unescape(summary)),
                        "pub_date": updated,
                        "link": link,
                    })

        return items
    except Exception as e:
        print(f"  [WARN] Failed to fetch {url}: {e}", file=sys.stderr)
        return []


def clean_html(text):
    """Strip HTML tags from text."""
    clean = re.sub(r"<[^>]+>", "", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def truncate(text, max_len=MAX_SUMMARY_LEN):
    """Truncate text to max_len, ending at a word boundary."""
    if len(text) <= max_len:
        return text
    truncated = text[:max_len].rsplit(" ", 1)[0]
    return truncated.rstrip(".,;:") + "..."


def auto_categorize(title, description, default="supply-chain"):
    """Determine article category based on keywords."""
    combined = (title + " " + description).lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in combined)
        if score > 0:
            scores[cat] = score
    if scores:
        return max(scores, key=scores.get)
    return default


def parse_date(date_str):
    """Parse RSS date into a datetime object."""
    formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S %Z",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, TypeError):
            continue
    return datetime.now()


def format_date(dt):
    """Format datetime for display."""
    return dt.strftime("%b %d, %Y")


# ─── Article Card Generator ─────────────────────────────────────────

def generate_card_html(article, is_featured=False):
    """Generate HTML for a blog card or featured card."""
    cat = article["category"]
    tag_class, tag_label = CATEGORY_TAGS.get(cat, ("tag-supply-chain", "Supply Chain"))
    date_str = format_date(article["date"])
    summary = truncate(article["description"])
    source = article.get("source", "Industry Source")

    if is_featured:
        return f"""                <article class="featured-card" data-category="{cat}">
                    <div class="featured-badge">FEATURED</div>
                    <div class="featured-content">
                        <div class="article-meta">
                            <span class="category-tag {tag_class}">{tag_label}</span>
                            <span class="article-date">{date_str}</span>
                        </div>
                        <h2>{html.escape(article['title'])}</h2>
                        <p>{html.escape(summary)}</p>
                        <div class="article-source">
                            <span>Source: {html.escape(source)}</span>
                        </div>
                    </div>
                </article>"""
    else:
        return f"""                    <article class="blog-card" data-category="{cat}">
                        <div class="card-header">
                            <span class="category-tag {tag_class}">{tag_label}</span>
                            <span class="article-date">{date_str}</span>
                        </div>
                        <h3>{html.escape(article['title'])}</h3>
                        <p>{html.escape(summary)}</p>
                        <div class="article-source">
                            <span>Source: {html.escape(source)}</span>
                        </div>
                    </article>"""


# ─── Main ────────────────────────────────────────────────────────────

def main():
    apply_mode = "--apply" in sys.argv or "--cron" in sys.argv
    cron_mode = "--cron" in sys.argv

    if not cron_mode:
        print("=" * 60)
        print("  Miami Alliance 3PL — Daily Blog News Updater")
        print("=" * 60)

    # Fetch all feeds
    all_articles = []
    for feed in RSS_FEEDS:
        if not cron_mode:
            print(f"\n  Fetching: {feed['name']}...")
        items = fetch_feed(feed["url"])
        for item in items:
            cat = auto_categorize(item["title"], item["description"], feed["category"])
            dt = parse_date(item["pub_date"])
            all_articles.append({
                "title": item["title"],
                "description": item["description"],
                "date": dt,
                "source": feed["name"],
                "category": cat,
                "link": item["link"],
            })

    if not all_articles:
        print("  [ERROR] No articles fetched from any feed.", file=sys.stderr)
        sys.exit(1)

    # Normalize all dates to offset-naive for consistent comparison
    for a in all_articles:
        if a["date"].tzinfo is not None:
            a["date"] = a["date"].replace(tzinfo=None)

    # Sort by date (newest first), deduplicate by title similarity
    all_articles.sort(key=lambda x: x["date"], reverse=True)

    # Remove old articles (older than 7 days)
    cutoff = datetime.now() - timedelta(days=7)
    # Make cutoff offset-naive if articles have offset-naive dates
    recent = []
    for a in all_articles:
        article_date = a["date"]
        if article_date.tzinfo is not None:
            article_date = article_date.replace(tzinfo=None)
        if article_date >= cutoff:
            recent.append(a)

    if not recent:
        recent = all_articles[:MAX_ARTICLES]

    # Deduplicate (simple title similarity)
    seen_titles = set()
    unique = []
    for article in recent:
        title_key = re.sub(r"[^a-z0-9]", "", article["title"].lower())[:50]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique.append(article)

    # Take top articles
    selected = unique[:MAX_ARTICLES + 1]  # +1 for featured

    if not cron_mode:
        print(f"\n  Found {len(all_articles)} total articles")
        print(f"  After filtering: {len(unique)} unique recent articles")
        print(f"  Selected: {len(selected)} for blog")
        print()
        for i, a in enumerate(selected):
            marker = "[FEATURED]" if i == 0 else f"[{i}]"
            print(f"  {marker} {a['title'][:70]}...")
            print(f"         {a['category'].upper()} | {a['source']} | {format_date(a['date'])}")

    if not apply_mode:
        print("\n  DRY RUN — Use --apply to write to blog.html")
        return

    # Generate HTML sections
    featured_html = generate_card_html(selected[0], is_featured=True)
    grid_cards = "\n\n".join(generate_card_html(a) for a in selected[1:])

    # Read current blog.html
    if not BLOG_HTML.exists():
        print(f"  [ERROR] blog.html not found at {BLOG_HTML}", file=sys.stderr)
        sys.exit(1)

    content = BLOG_HTML.read_text(encoding="utf-8")

    # Replace featured section
    featured_pattern = r'(<section class="blog-featured">\s*<div class="container">)\s*<article.*?</article>\s*(</div>\s*</section>)'
    featured_replacement = f"\\1\n{featured_html}\n            \\2"
    content = re.sub(featured_pattern, featured_replacement, content, flags=re.DOTALL)

    # Replace grid section
    grid_pattern = r'(<div class="blog-grid">)\s*.*?\s*(</div>\s*</div>\s*</section>\s*<!-- Industry Insight)'
    grid_replacement = f"\\1\n\n{grid_cards}\n\n                \\2"
    content = re.sub(grid_pattern, grid_replacement, content, flags=re.DOTALL)

    # Write back
    BLOG_HTML.write_text(content, encoding="utf-8")

    if not cron_mode:
        print(f"\n  ✅ blog.html updated with {len(selected)} articles")
        print(f"  📄 {BLOG_HTML}")
    else:
        print(f"[{datetime.now().isoformat()}] Blog updated: {len(selected)} articles")

    # Auto-commit and push in cron mode
    if cron_mode or "--push" in sys.argv:
        try:
            today = datetime.now().strftime("%Y-%m-%d")
            msg = f"📰 Daily blog update — {today} ({len(selected)} articles)"
            subprocess.run(
                ["git", "add", "blog.html"],
                cwd=str(PROJECT_ROOT), check=True, capture_output=True
            )
            subprocess.run(
                ["git", "commit", "-m", msg],
                cwd=str(PROJECT_ROOT), check=True, capture_output=True
            )
            subprocess.run(
                ["git", "push"],
                cwd=str(PROJECT_ROOT), check=True, capture_output=True
            )
            if not cron_mode:
                print(f"  🚀 Committed & pushed: {msg}")
            else:
                print(f"[{datetime.now().isoformat()}] Git push OK")
        except subprocess.CalledProcessError as e:
            err_msg = e.stderr.decode() if e.stderr else str(e)
            print(f"  [WARN] Git push failed: {err_msg}", file=sys.stderr)


if __name__ == "__main__":
    main()
