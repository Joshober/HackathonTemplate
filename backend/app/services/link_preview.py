"""Best-effort link preview images (og:image / twitter:image) for result URLs."""

from __future__ import annotations

import ipaddress
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _host_is_blocked(hostname: str) -> bool:
    h = (hostname or "").strip().lower()
    if not h:
        return True
    if h in ("localhost",) or h.endswith(".local"):
        return True
    try:
        ip = ipaddress.ip_address(h)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return True
    except ValueError:
        pass
    return False


def og_image_for_url(
    page_url: str, *, timeout: float = 3.5, max_bytes: int = 400_000
) -> str | None:
    """
    Fetch the page HTML (partial read) and return an absolute image URL from
    og:image, twitter:image, or link[rel=image_src], or None.
    """
    raw = (page_url or "").strip()
    if not raw:
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        return None
    if _host_is_blocked(parsed.hostname or ""):
        return None

    try:
        with requests.get(
            raw, headers=_BROWSER_HEADERS, timeout=timeout, stream=True
        ) as resp:
            resp.raise_for_status()
            chunks: list[bytes] = []
            total = 0
            for chunk in resp.iter_content(16_384):
                if not chunk:
                    break
                chunks.append(chunk)
                total += len(chunk)
                blob = b"".join(chunks)
                if b"</head>" in blob.lower() or total >= max_bytes:
                    break
            html = b"".join(chunks).decode("utf-8", errors="replace")
    except (requests.RequestException, OSError, UnicodeDecodeError):
        return None

    soup = BeautifulSoup(html, "html.parser")

    def absolutize(href: str | None) -> str | None:
        if not href or not str(href).strip():
            return None
        joined = urljoin(raw, str(href).strip())
        p = urlparse(joined)
        if p.scheme not in ("http", "https"):
            return None
        if _host_is_blocked(p.hostname or ""):
            return None
        return joined

    for prop in ("og:image:secure_url", "og:image:url", "og:image"):
        tag = soup.find("meta", property=prop)
        if tag and tag.get("content"):
            out = absolutize(tag.get("content"))
            if out:
                return out

    for name in ("twitter:image:src", "twitter:image"):
        tag = soup.find("meta", attrs={"name": name})
        if tag and tag.get("content"):
            out = absolutize(tag.get("content"))
            if out:
                return out

    tag = soup.find("meta", attrs={"itemprop": "image"})
    if tag and tag.get("content"):
        out = absolutize(tag.get("content"))
        if out:
            return out

    for link in soup.find_all("link", rel=True):
        rel = link.get("rel")
        rel_s = " ".join(rel).lower() if isinstance(rel, list) else str(rel).lower()
        if "image_src" in rel_s and link.get("href"):
            out = absolutize(link.get("href"))
            if out:
                return out

    return None
