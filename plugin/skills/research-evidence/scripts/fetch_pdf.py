#!/usr/bin/env python3
"""Acquire a paper PDF through the personal evidence source order."""

import argparse
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from typing import Callable, Dict, Iterable, List, Optional, Tuple
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
ARXIV_DOI_PREFIX = "10.48550/"
EXIT_NO_PDF = 1
EXIT_CONFIGURATION = 2
EXIT_MANUSCRIPT = 3
Getter = Callable[[str, str, Optional[str], float], bytes]


class AcquisitionError(RuntimeError):
    """A configuration or acquisition boundary prevented a valid result."""

    def __init__(self, message: str, status: Optional[int] = None) -> None:
        super().__init__(message)
        self.status = status


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
        raise AcquisitionError(str(error), getattr(error, "code", None)) from error


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
    except AcquisitionError as error:
        if error.status == 404:
            # Unpaywall does not know the DOI, as for arXiv DOIs: no open-access data, not a failure.
            return {}
        # Going on without the lookup could return a manuscript where an open published copy exists.
        raise AcquisitionError(
            "the open-access lookup failed ({}). No source was tried. Run it again.".format(error)
        ) from error
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise AcquisitionError(
            "the open-access lookup returned an unreadable answer. No source was tried. Run it again."
        ) from error
    if not isinstance(record, dict):
        raise AcquisitionError(
            "the open-access lookup returned an unreadable answer. No source was tried. Run it again."
        )
    genre = record.get("genre")
    if not record.get("is_oa"):
        return {"genre": genre}
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
    return {"publisher_pdf": publisher, "repository_pdf": repository, "genre": genre}


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


def acquire_with_lookup(
    doi: Optional[str],
    arxiv_id: Optional[str],
    email: Optional[str],
    getter: Getter = _network_get,
    mirrors: Iterable[str] = SCIHUB_MIRRORS,
) -> Tuple[Optional[bytes], Optional[str], Dict[str, Optional[str]]]:
    """Acquire bytes and return the open-access lookup that guided the order."""
    info = _unpaywall(doi, email or "", getter) if doi else {}

    publisher_url = info.get("publisher_pdf")
    publisher = _get_pdf(publisher_url, getter)
    if publisher:
        return publisher, "OA publisher {}".format(publisher_url), info

    if doi:
        data, source = _from_scihub(doi, getter, mirrors)
        if data:
            return data, source, info

    repository_url = info.get("repository_pdf")
    repository = _get_pdf(repository_url, getter)
    if repository:
        return repository, "OA repository {}".format(repository_url), info

    if arxiv_id:
        arxiv_url = "https://arxiv.org/pdf/{}".format(arxiv_id)
        arxiv = _get_pdf(arxiv_url, getter)
        if arxiv:
            return arxiv, "arxiv {}".format(arxiv_url), info

    return None, None, info


def acquire(
    doi: Optional[str],
    arxiv_id: Optional[str],
    email: Optional[str],
    getter: Getter = _network_get,
    mirrors: Iterable[str] = SCIHUB_MIRRORS,
) -> Tuple[Optional[bytes], Optional[str]]:
    """Acquire bytes through publisher, Sci-Hub, repository, then arXiv."""
    data, source, _ = acquire_with_lookup(doi, arxiv_id, email, getter, mirrors)
    return data, source


def is_manuscript_of_published_work(
    doi: Optional[str], source: str, info: Dict[str, Optional[str]]
) -> bool:
    """Tell whether the copy is a manuscript although the DOI names a published work.

    An unknown genre counts as published, because a needless question costs
    less than an unnoticed manuscript.
    """
    if not doi or doi.lower().startswith(ARXIV_DOI_PREFIX):
        return False
    if info.get("genre") == "posted-content":
        return False
    return source.startswith(("OA repository ", "arxiv "))


def main(
    argv: Optional[List[str]] = None,
    getter: Getter = _network_get,
    mirrors: Iterable[str] = SCIHUB_MIRRORS,
) -> int:
    parser = argparse.ArgumentParser(description="Acquire a validated paper PDF")
    parser.add_argument("key", help="BibTeX key; the default output is papers/<key>.pdf")
    parser.add_argument("--doi")
    parser.add_argument("--arxiv")
    parser.add_argument("--out")
    args = parser.parse_args(argv)

    if not args.doi and not args.arxiv:
        parser.error("provide --doi and/or --arxiv")

    output = Path(args.out or "papers/{}.pdf".format(args.key))
    try:
        data, source, info = acquire_with_lookup(
            args.doi, args.arxiv, os.environ.get("UNPAYWALL_EMAIL"), getter, mirrors
        )
    except AcquisitionError as error:
        print("FAIL {}: {}".format(args.key, error), file=sys.stderr)
        return EXIT_CONFIGURATION

    if not data or not source:
        attempted = "publisher OA, Sci-Hub, repository OA"
        if args.arxiv:
            attempted += ", arXiv"
        print(
            "FAIL {}: no PDF via {}. Obtain an author or institutional copy and save it to {}.".format(
                args.key, attempted, output
            ),
            file=sys.stderr,
        )
        return EXIT_NO_PDF

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data)
    size = len(data) // 1024
    if is_manuscript_of_published_work(args.doi, source, info):
        print(
            "MANUSCRIPT {}: {} KB from {} -> {}. The DOI names a published work and its "
            "published version was not obtained. Ask before citing from this copy.".format(
                args.key, size, source, output
            )
        )
        return EXIT_MANUSCRIPT
    print("OK {}: {} KB from {} -> {}".format(args.key, size, source, output))
    return 0


if __name__ == "__main__":
    sys.exit(main())
