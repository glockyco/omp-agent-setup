#!/usr/bin/env python3
"""Retrieve a paper's full-text PDF into papers/<bibtex-key>.pdf.

Source order (best canonical copy first; see papers/AGENTS.md):

  1. Open access, publisher-hosted  -- the official published PDF at the DOI,
     for gold/hybrid OA articles. Preferred when available.
  2. Sci-Hub                         -- the *published* version for paywalled
     articles. Beats a repository preprint, so it comes before green OA.
  3. Open access, repository/green   -- the author's accepted/submitted
     manuscript, when 1 and 2 fail.
  4. arXiv                           -- genuine preprints, or last resort when
     no published PDF is retrievable.
  (5. Manual                         -- author copy / institutional library;
     not automated. The script reports FAIL so you can flag it.)

Why this is not a one-line curl: Sci-Hub returns an HTML *viewer*, not the PDF.
The real PDF URL lives in the page's <meta name="citation_pdf_url"> tag (with an
<embed>/<iframe> src as a fallback). We extract that, download it, and validate
the %PDF header before saving, so we never store an HTML page as a .pdf. Every
candidate download is validated the same way.

Usage:
  uv run --no-project python fetch_pdf.py KEY --doi 10.1145/2786805.2786825
  uv run --no-project python fetch_pdf.py KEY --arxiv 2406.05397            # genuine preprints only
  uv run --no-project python fetch_pdf.py KEY --doi 10.x/y --arxiv 2406.05397   # arXiv as last resort
  uv run --no-project python fetch_pdf.py KEY --doi 10.x/y --out papers/KEY.pdf
"""
import argparse
import json
import os
import pathlib
import sys
import re
import urllib.error
import urllib.request

# A browser User-Agent; Sci-Hub/Cloudflare reject the default urllib agent.
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124 Safari/537.36")

# Working mirrors, most-reliable first. The .se domain has been unreliable for
# PDF retrieval. If all fail, find the current working mirror and update this
# list (and papers/AGENTS.md).
SCIHUB_MIRRORS = ["https://sci-hub.st", "https://sci-hub.box", "https://sci-hub.ru"]

# Unpaywall requires a contact email per its terms of use. Override per user via the
# UNPAYWALL_EMAIL environment variable; the default below is a valid noreply address.
UNPAYWALL_EMAIL = os.environ.get("UNPAYWALL_EMAIL", "writing-bib@users.noreply.github.com")

PAGE_TIMEOUT = 30   # seconds; landing/API pages are small but can be slow
PDF_TIMEOUT = 90    # seconds; PDFs can be several MB over a slow mirror


def _open(url, accept="*/*", referer=None, timeout=PAGE_TIMEOUT):
    headers = {"User-Agent": UA, "Accept": accept}
    if referer:
        headers["Referer"] = referer
    return urllib.request.urlopen(
        urllib.request.Request(url, headers=headers), timeout=timeout)


def _download_pdf(url, referer=None):
    """Download url; return bytes only if they are actually a PDF, else None."""
    if not url:
        return None
    try:
        with _open(url, accept="application/pdf,*/*", referer=referer,
                   timeout=PDF_TIMEOUT) as r:
            data = r.read()
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    return data if data[:5] == b"%PDF-" else None


def unpaywall(doi):
    """Return {'publisher_pdf', 'any_pdf', 'host', 'version'} for an OA article.

    publisher_pdf is a direct PDF from a publisher-hosted OA location (the
    official version); any_pdf is the best available OA PDF (often a repository
    manuscript). Both are None when Unpaywall has no direct PDF link.
    """
    try:
        with _open(f"https://api.unpaywall.org/v2/{doi}?email={UNPAYWALL_EMAIL}",
                   accept="application/json") as r:
            rec = json.loads(r.read())
    except (urllib.error.URLError, TimeoutError, ValueError):
        return {}
    if not rec.get("is_oa"):
        return {}
    locs = rec.get("oa_locations") or []
    # Within a host class, prefer the published version.
    ranked = sorted(locs, key=lambda l: l.get("version") == "publishedVersion",
                    reverse=True)
    publisher_pdf = next((l.get("url_for_pdf") for l in ranked
                          if l.get("host_type") == "publisher" and l.get("url_for_pdf")), None)
    any_pdf = next((l.get("url_for_pdf") for l in ranked if l.get("url_for_pdf")), None)
    best = rec.get("best_oa_location") or {}
    return {"publisher_pdf": publisher_pdf, "any_pdf": any_pdf,
            "host": best.get("host_type"), "version": best.get("version")}


def from_scihub(doi):
    for base in SCIHUB_MIRRORS:
        try:
            with _open(f"{base}/{doi}") as r:
                html = r.read().decode("utf-8", "replace")
        except (urllib.error.URLError, TimeoutError):
            continue
        m = re.search(r'name="citation_pdf_url"\s+content="([^"]+)"', html, re.I)
        if not m:
            m = re.search(r'<(?:embed|iframe)[^>]+src\s*=\s*"([^"]+\.pdf[^"]*)"', html, re.I)
        if not m:
            continue  # mirror has only metadata, not the file
        url = m.group(1)
        if url.startswith("//"):
            url = "https:" + url
        elif url.startswith("/"):
            url = base + url
        data = _download_pdf(url, referer=f"{base}/{doi}")
        if data:
            return data, f"sci-hub {base}"
    return None, None


def from_arxiv(arxiv_id):
    url = f"https://arxiv.org/pdf/{arxiv_id}"
    data = _download_pdf(url)
    return (data, f"arxiv {url}") if data else (None, None)


def acquire(doi, arxiv_id):
    info = unpaywall(doi) if doi else {}
    # 1. Official open access (publisher-hosted published PDF).
    if info.get("publisher_pdf"):
        data = _download_pdf(info["publisher_pdf"])
        if data:
            return data, f"OA publisher {info['publisher_pdf']}"
    # 2. Sci-Hub (published version for paywalled articles).
    if doi:
        data, source = from_scihub(doi)
        if data:
            return data, source
    # 3. Repository / green OA (author manuscript).
    if info.get("any_pdf"):
        data = _download_pdf(info["any_pdf"])
        if data:
            return data, f"OA {info.get('host')} ({info.get('version')}) {info['any_pdf']}"
    # 4. arXiv (preprints, or last resort).
    if arxiv_id:
        return from_arxiv(arxiv_id)
    return None, None


def main():
    ap = argparse.ArgumentParser(
        description="Retrieve a paper's full-text PDF into papers/<key>.pdf")
    ap.add_argument("key", help="BibTeX key; output filename defaults to <key>.pdf")
    ap.add_argument("--doi", help="DOI (preferred: gets the published version)")
    ap.add_argument("--arxiv", help="arXiv id, e.g. 2406.05397 (genuine preprints only)")
    ap.add_argument("--out", help="output path (default: papers/<key>.pdf)")
    args = ap.parse_args()

    if not args.doi and not args.arxiv:
        ap.error("provide --doi and/or --arxiv")

    out = pathlib.Path(args.out or f"papers/{args.key}.pdf")
    data, source = acquire(args.doi, args.arxiv)

    if not data:
        tried = "OA, sci-hub" + (", arxiv" if args.arxiv else "")
        print(f"FAIL {args.key}: no PDF via {tried}. Find an OA author copy or "
              f"use institutional access, then save to {out}; flag for manual "
              f"acquisition.", file=sys.stderr)
        return 1

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    print(f"OK {args.key}: {len(data) // 1024} KB from {source} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
