"""Hackathon-only: DDG snippets + optional light HTML fetch. Set TRAVEL_SCRAPE_OPTIONS=1."""

from __future__ import annotations

import os
from urllib.parse import urlparse

import requests

from app.services.web_search import duckduckgo_text_results

_SCRAPE_ON = frozenset({"1", "true", "yes"})


def scrape_enabled() -> bool:
    v = (os.getenv("TRAVEL_SCRAPE_OPTIONS") or "").strip().lower()
    return v in _SCRAPE_ON


def _fetch_page_title(url: str, timeout: float = 4.0, max_bytes: int = 120_000) -> str | None:
    try:
        r = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "HackathonTravelBot/1.0"},
            stream=True,
        )
        if r.status_code != 200:
            return None
        buf = b""
        for chunk in r.iter_content(8192):
            buf += chunk
            if len(buf) >= max_bytes:
                break
        text = buf.decode("utf-8", errors="replace")
    except OSError:
        return None
    except Exception:
        return None
    try:
        from bs4 import BeautifulSoup

        soup = BeautifulSoup(text[:max_bytes], "html.parser")
        t = soup.find("title")
        if t and t.string:
            return t.string.strip()[:200]
    except Exception:
        pass
    low = text.lower()
    if "<title>" in low:
        start = low.find("<title>") + 7
        end = low.find("</title>", start)
        if end > start:
            return text[start:end].strip()[:200]
    return None


def _safe_http_url(url: str) -> bool:
    try:
        p = urlparse(url)
        return p.scheme in ("http", "https") and bool(p.netloc)
    except Exception:
        return False


def collect_scraped_options(
    origin_iata: str,
    city: str,
    outbound: str,
    inbound: str | None,
    max_ddg: int = 6,
    max_html: int = 2,
) -> tuple[list[dict], str | None]:
    if not scrape_enabled():
        return [], None
    out: list[dict] = []
    seen: set[str] = set()
    queries = [
        f"cheap flights {origin_iata} to {city} {outbound}",
        f"hotels {city} check in {outbound}",
    ]
    if inbound:
        queries.append(f"round trip flights {origin_iata} {city} return {inbound}")
    err: str | None = None
    for q in queries:
        try:
            rows = duckduckgo_text_results(q, max_results=max_ddg)
        except Exception as e:
            err = str(e)
            rows = []
        for r in rows:
            href = (r.get("href") or "").strip()
            if not href or href in seen:
                continue
            seen.add(href)
            kind = "flight" if "flight" in q else "hotel" if "hotel" in q else "mixed"
            out.append(
                {
                    "title": (r.get("title") or "")[:300],
                    "snippet": (r.get("body") or "")[:500],
                    "url": href[:2000],
                    "kind": kind,
                    "sourceQuery": q[:200],
                }
            )
    html_enriched = 0
    for opt in out[:8]:
        if html_enriched >= max_html:
            break
        u = opt.get("url") or ""
        if not isinstance(u, str) or not _safe_http_url(u):
            continue
        title = _fetch_page_title(u)
        if title:
            opt["pageTitle"] = title
            html_enriched += 1
    return out[:12], err
