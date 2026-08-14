#!/usr/bin/env python3
"""Acquire a paper PDF through the personal evidence source order."""

import argparse
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from typing import Callable, Dict, Iterable, Optional, Tuple
from urllib.error import URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
)
SCIHUB_MIRRORS = (
    "https://sci-hub.st",
    "https://sci-hub.box",
    "https://sci-hub.ru",
)
PAGE_TIMEOUT = 30.0
PDF_TIMEOUT = 90.0
Getter = Callable[[str, str, Optional[str], float], bytes]


class AcquisitionError(RuntimeError):
    """A configuration or acquisition boundary prevented a valid result."""


class _ViewerParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta_pdf = None  # type: Optional[str]
        self.embedded_pdf = None  # type: Optional[str]

    def handle_starttag(self, tag: str, attrs: Iterable[Tuple[str, Optional[str]]]) -> None:
        values = {name.lower(): value for name, value in attrs}
        if tag.lower() == "meta" and values.get("name", "").lower() == "citation_pdf_url":
            self.meta_pdf = values.get("content")
        if tag.lower() in ("embed", "iframe"):
            source = values.get("src")
            if source and re.search(r"\.pdf(?:$|[?#])", source, re.IGNORECASE):
                self.embedded_pdf = source


def resolve_viewer_pdf_url(viewer_url: str, html: bytes) -> Optional[str]:
    """Return the absolute PDF URL declared by a Sci-Hub viewer."""
    parser = _ViewerParser()
    parser.feed(html.decode("utf-8", "replace"))
    candidate = parser.meta_pdf or parser.embedded_pdf
    return urljoin(viewer_url, candidate) if candidate else None


def is_pdf(data: bytes) -> bool:
    return data.startswith(b"%PDF-")


def _network_get(url: str, accept: str, referer: Optional[str], timeout: float) -> bytes:
    headers = {"User-Agent": USER_AGENT, "Accept": accept}
    if referer:
        headers["Referer"] = referer
    request = Request(url, headers=headers)
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read()
    except (URLError, TimeoutError, ValueError) as error:
        raise AcquisitionError(str(error)) from error


def _get_pdf(url: Optional[str], getter: Getter, referer: Optional[str] = None) -> Optional[bytes]:
    if not url:
        return None
    try:
        data = getter(url, "application/pdf,*/*", referer, PDF_TIMEOUT)
    except AcquisitionError:
        return None
    return data if is_pdf(data) else None


def _unpaywall(doi: str, email: str, getter: Getter) -> Dict[str, Optional[str]]:
    if not email.strip():
        raise AcquisitionError("UNPAYWALL_EMAIL is required for DOI acquisition")
    url = "https://api.unpaywall.org/v2/{}?email={}".format(doi, quote(email, safe="@"))
    try:
        record = json.loads(getter(url, "application/json", None, PAGE_TIMEOUT))
    except (AcquisitionError, json.JSONDecodeError, UnicodeDecodeError):
        return {}
    if not record.get("is_oa"):
        return {}
    locations = sorted(
        record.get("oa_locations") or [],
        key=lambda item: item.get("version") == "publishedVersion",
        reverse=True,
    )
    publisher = next(
        (
            item.get("url_for_pdf")
            for item in locations
            if item.get("host_type") == "publisher" and item.get("url_for_pdf")
        ),
        None,
    )
    repository = next(
        (
            item.get("url_for_pdf")
            for item in locations
            if item.get("host_type") != "publisher" and item.get("url_for_pdf")
        ),
        None,
    )
    return {"publisher_pdf": publisher, "repository_pdf": repository}


def _from_scihub(
    doi: str,
    getter: Getter,
    mirrors: Iterable[str],
) -> Tuple[Optional[bytes], Optional[str]]:
    for base in mirrors:
        viewer_url = "{}/{}".format(base.rstrip("/"), doi)
        try:
            viewer = getter(viewer_url, "text/html,*/*", None, PAGE_TIMEOUT)
        except AcquisitionError:
            continue
        pdf_url = resolve_viewer_pdf_url(viewer_url, viewer)
        data = _get_pdf(pdf_url, getter, referer=viewer_url)
        if data:
            return data, "sci-hub {}".format(base)
    return None, None


def acquire(
    doi: Optional[str],
    arxiv_id: Optional[str],
    email: Optional[str],
    getter: Getter = _network_get,
    mirrors: Iterable[str] = SCIHUB_MIRRORS,
) -> Tuple[Optional[bytes], Optional[str]]:
    """Acquire bytes through publisher, Sci-Hub, repository, then arXiv."""
    info = _unpaywall(doi, email or "", getter) if doi else {}

    publisher_url = info.get("publisher_pdf")
    publisher = _get_pdf(publisher_url, getter)
    if publisher:
        return publisher, "OA publisher {}".format(publisher_url)

    if doi:
        data, source = _from_scihub(doi, getter, mirrors)
        if data:
            return data, source

    repository_url = info.get("repository_pdf")
    repository = _get_pdf(repository_url, getter)
    if repository:
        return repository, "OA repository {}".format(repository_url)

    if arxiv_id:
        arxiv_url = "https://arxiv.org/pdf/{}".format(arxiv_id)
        arxiv = _get_pdf(arxiv_url, getter)
        if arxiv:
            return arxiv, "arxiv {}".format(arxiv_url)

    return None, None


def main() -> int:
    parser = argparse.ArgumentParser(description="Acquire a validated paper PDF")
    parser.add_argument("key", help="BibTeX key; the default output is papers/<key>.pdf")
    parser.add_argument("--doi")
    parser.add_argument("--arxiv")
    parser.add_argument("--out")
    args = parser.parse_args()

    if not args.doi and not args.arxiv:
        parser.error("provide --doi and/or --arxiv")

    output = Path(args.out or "papers/{}.pdf".format(args.key))
    try:
        data, source = acquire(args.doi, args.arxiv, os.environ.get("UNPAYWALL_EMAIL"))
    except AcquisitionError as error:
        print("FAIL {}: {}".format(args.key, error), file=sys.stderr)
        return 2

    if not data:
        attempted = "publisher OA, Sci-Hub, repository OA"
        if args.arxiv:
            attempted += ", arXiv"
        print(
            "FAIL {}: no PDF via {}. Obtain an author or institutional copy and save it to {}.".format(
                args.key, attempted, output
            ),
            file=sys.stderr,
        )
        return 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
    print("OK {}: {} KB from {} -> {}".format(args.key, len(data) // 1024, source, output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
