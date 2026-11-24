#!/usr/bin/env python3
"""Search literature indexes with shared pacing, a query log and a corpus with abstracts."""

import argparse
import json
import os
from pathlib import Path
import re
import sys
import time
from typing import Callable, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ElementTree

INDEXES = ("openalex", "arxiv", "crossref", "dblp", "semanticscholar")
# Seconds between two requests to one index, shared by every process that uses the same state directory.
# Semantic Scholar allows one request per second for a key across all endpoints.
# OpenAlex allows one semantic search per second, so semantic searches keep their own, wider spacing.
SPACING = {"openalex": 0.5, "openalex-semantic": 1.1, "arxiv": 4.0, "crossref": 1.0, "dblp": 2.5, "semanticscholar": 1.1}
# arXiv allows a single connection at a time, Semantic Scholar one request per second however long a request takes,
# and OpenAlex one semantic search at a time. For these, a request holds a lock until its answer arrives.
SINGLE_CONNECTION = ("arxiv", "semanticscholar", "openalex-semantic")
# How long a search waits for another search's open request on the same index before it fails.
CONNECTION_WAIT = 600.0
# OpenAlex bills searches and refuses them without a key on a busy network address.
# Semantic Scholar refuses almost every request without a key.
NEEDS_KEY = ("openalex", "semanticscholar")
S2_PAPER_FIELDS = "externalIds,title,abstract,authors,year,venue,publicationDate"
# Waits of 2, 4, 8, 16, 32 and 64 seconds between seven attempts, unless the index names a wait. arXiv, OpenAlex
# and Semantic Scholar all throttled bursts for longer than a fixed short wait covers.
MAX_ATTEMPTS = 7
MAX_WAIT = 120.0
TIMEOUT = 45.0
EXIT_FAILED = 2
SEMANTIC_MAX = 50
# The documentation allows 2,000 characters, but the API answers 400 from about 1,530 on.
SEMANTIC_CHARS = 1500
ATOM = "{http://www.w3.org/2005/Atom}"

# (status, body, seconds the index asks to wait or None)
Response = Tuple[int, bytes, Optional[float]]
# (url, headers, JSON body for a POST or None)
Getter = Callable[[str, Dict[str, str], Optional[bytes]], Response]


class SearchError(RuntimeError):
    """The query could not be answered. This is not evidence that nothing exists."""


def http_get(url: str, headers: Dict[str, str], body: Optional[bytes] = None) -> Response:
    try:
        request = Request(url, data=body, headers=dict(headers, **({"Content-Type": "application/json"} if body else {})))
        with urlopen(request, timeout=TIMEOUT) as response:
            return response.status, response.read(), None
    except HTTPError as error:
        retry_after = error.headers.get("Retry-After") if error.headers else None
        try:
            wait = float(retry_after) if retry_after else None
        except ValueError:
            wait = None
        return error.code, b"", wait
    except (URLError, TimeoutError, OSError):
        return 0, b"", None


class Pacer:
    """Space requests per index across processes through files in a state directory."""

    def __init__(self, state: Path, now: Callable[[], float] = time.time, sleep: Callable[[float], None] = time.sleep):
        self.state, self.now, self.sleep = state, now, sleep

    def _locked(self, name: str, action: Callable[[], Optional[float]]) -> Optional[float]:
        lock = self.state / (name + ".lock")
        for _ in range(2000):
            try:
                handle = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except FileExistsError:
                # A lock left by a crashed process expires, so it delays one request only.
                try:
                    if self.now() - lock.stat().st_mtime > 30:
                        lock.unlink()
                except OSError:
                    pass
                self.sleep(0.05)
                continue
            try:
                return action()
            finally:
                os.close(handle)
                try:
                    lock.unlink()
                except OSError:
                    pass
        raise SearchError("the state directory stayed locked")

    def wait_turn(self, index: str) -> None:
        slot = self.state / ("next-" + index)

        def claim() -> float:
            try:
                earliest = float(slot.read_text())
            except (OSError, ValueError):
                earliest = 0.0
            start = max(self.now(), earliest)
            slot.write_text(repr(start + SPACING[index]))
            return start

        start = self._locked("pace-" + index, claim)
        delay = (start or 0.0) - self.now()
        if delay > 0:
            self.sleep(delay)

    def push_back(self, index: str, seconds: float) -> None:
        slot = self.state / ("next-" + index)
        self._locked("pace-" + index, lambda: slot.write_text(repr(self.now() + seconds)) and None)

    def exclusive(self, name: str, action: Callable[[], None]) -> None:
        self._locked(name, lambda: action() or None)

    def connection(self, lane: str, request: Callable[[], Response]) -> Response:
        """Run one request while no other process on this machine has a request open to the same index.

        A request can take up to TIMEOUT seconds, so this lock waits longer than the short state locks, and a lock
        older than a request can last counts as left by a crashed process.
        """
        lock = self.state / ("connection-" + lane + ".lock")
        waited = 0.0
        while True:
            try:
                handle = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                break
            except FileExistsError:
                try:
                    if self.now() - lock.stat().st_mtime > TIMEOUT + MAX_WAIT:
                        lock.unlink()
                except OSError:
                    pass
                if waited > CONNECTION_WAIT:
                    raise SearchError("another search held the {} connection for more than {:.0f} s".format(lane, CONNECTION_WAIT))
                self.sleep(0.2)
                waited += 0.2
        try:
            self.wait_turn(lane)
            return request()
        finally:
            os.close(handle)
            try:
                lock.unlink()
            except OSError:
                pass


def default_pace_dir() -> Path:
    """The pacing state every search of this user shares, because providers count requests per key or machine."""
    configured = os.environ.get("RESEARCH_EVIDENCE_PACE_DIR")
    return Path(configured) if configured else Path.home() / ".cache" / "research-evidence" / "pace"


def semantic_text(text: str) -> str:
    """Keep the words of a description. OpenAlex rejects some punctuation in a semantic query."""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s\-]", " ", text)).strip()[:SEMANTIC_CHARS]


def work_id(doi: Optional[str], arxiv: Optional[str], fallback: str) -> str:
    doi = (doi or "").lower().replace("https://doi.org/", "")
    match = re.match(r"10\.48550/arxiv\.(.+)", doi)
    if arxiv or match:
        return "arxiv:" + re.sub(r"v\d+$", "", arxiv or match.group(1))
    return "doi:" + doi if doi else fallback


def build_url(index: str, mode: str, query: str, year_from: Optional[int], sort: str, start: int, rows: int, mail: str) -> str:
    if index == "openalex":
        select = "id,doi,title,publication_date,authorships,primary_location,abstract_inverted_index,cited_by_count"
        if mode == "semantic":
            # Semantic search matches by meaning, returns at most 50 works and accepts only a few filters.
            params = {"search.semantic": semantic_text(query), "per-page": str(min(rows, SEMANTIC_MAX)), "select": select}
            if year_from:
                params["filter"] = "publication_year:>{}".format(year_from - 1)
            return "https://api.openalex.org/works?" + urlencode(params)
        if mode == "citing":
            filters = ["cites:" + query]
        elif mode == "cited":
            filters = ["cited_by:" + query]
        elif mode == "related":
            filters = ["related_to:" + query]
        elif mode == "lookup":
            # DOIs separated by "|". An arXiv preprint has the DOI 10.48550/arxiv.<id>.
            filters = ["doi:" + query]
        else:
            filters = ["title_and_abstract.search:" + query.replace(",", " ")]
        if year_from:
            filters.append("from_publication_date:{}-01-01".format(year_from))
        params = {
            "filter": ",".join(filters),
            "per-page": str(rows),
            "page": str(start // rows + 1),
            "select": select,
        }
        if sort == "date":
            params["sort"] = "publication_date:desc"
        elif mode != "search":
            params["sort"] = "cited_by_count:desc"
        return "https://api.openalex.org/works?" + urlencode(params)
    if index == "arxiv":
        terms = query if re.search(r"\b(abs|ti|all|cat|au):", query) else "all:" + query
        if year_from:
            terms = "({}) AND submittedDate:[{}01010000 TO 209912312359]".format(terms, year_from)
        return "https://export.arxiv.org/api/query?" + urlencode(
            {
                "search_query": terms,
                "start": str(start),
                "max_results": str(rows),
                "sortBy": "submittedDate" if sort == "date" else "relevance",
                "sortOrder": "descending",
            }
        )
    if index == "crossref":
        params = {
            "query.bibliographic": query,
            "rows": str(rows),
            "offset": str(start),
            "select": "DOI,title,container-title,issued,author,abstract,type",
        }
        if year_from:
            params["filter"] = "from-pub-date:{}-01-01".format(year_from)
        if sort == "date":
            params["sort"], params["order"] = "issued", "desc"
        if mail:
            params["mailto"] = mail
        return "https://api.crossref.org/works?" + urlencode(params)
    if index == "semanticscholar":
        if mode == "papers":
            # A batch lookup: the IDs travel in the POST body that request_body builds.
            return "https://api.semanticscholar.org/graph/v1/paper/batch?" + urlencode({"fields": S2_PAPER_FIELDS})
        # Snippet search matches passages of full text and abstracts by meaning.
        return "https://api.semanticscholar.org/graph/v1/snippet/search?" + urlencode({"query": query, "limit": str(rows)})
    return "https://dblp.org/search/publ/api?" + urlencode({"q": query, "format": "json", "h": str(rows), "f": str(start)})


def request_body(index: str, mode: str, query: str) -> Optional[bytes]:
    if index == "semanticscholar" and mode == "papers":
        return json.dumps({"ids": [i.strip() for i in query.split(",") if i.strip()]}).encode()
    return None


def _clean(text: Optional[str]) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", text or "")).strip()


def parse(index: str, body: bytes) -> Tuple[Optional[int], List[dict]]:
    works = []  # type: List[dict]
    if index == "arxiv":
        root = ElementTree.fromstring(body)
        total = root.findtext("{http://a9.com/-/spec/opensearch/1.1/}totalResults")
        for entry in root.findall(ATOM + "entry"):
            identifier = (entry.findtext(ATOM + "id") or "").rsplit("/abs/", 1)[-1]
            category = entry.find("{http://arxiv.org/schemas/atom}primary_category")
            works.append(
                {
                    "id": work_id(None, identifier, ""),
                    "title": _clean(entry.findtext(ATOM + "title")),
                    "authors": [_clean(a.findtext(ATOM + "name")) for a in entry.findall(ATOM + "author")],
                    "date": (entry.findtext(ATOM + "published") or "")[:10],
                    "venue": "arXiv " + (category.get("term", "") if category is not None else ""),
                    "abstract": _clean(entry.findtext(ATOM + "summary")),
                }
            )
        return (int(total) if total else None), works
    data = json.loads(body)
    if index == "semanticscholar":
        if isinstance(data, list):
            works = []
            for paper in [p for p in data if p]:
                ids = paper.get("externalIds") or {}
                corpus = str(ids.get("CorpusId") or paper.get("corpusId") or "")
                works.append(
                    {
                        "id": work_id(ids.get("DOI"), ids.get("ArXiv"), "s2:" + corpus),
                        "s2": corpus,
                        "title": _clean(paper.get("title")),
                        "authors": [a.get("name", "") for a in paper.get("authors") or []],
                        "date": paper.get("publicationDate") or str(paper.get("year") or ""),
                        "venue": _clean(paper.get("venue")),
                        "abstract": _clean(paper.get("abstract")),
                    }
                )
            return len(works), works
        seen = {}  # type: Dict[str, dict]
        for item in data.get("data") or []:
            paper = item.get("paper") or {}
            corpus = str(paper.get("corpusId") or "")
            if corpus and corpus not in seen:
                seen[corpus] = {"id": "s2:" + corpus, "s2": corpus, "title": _clean(paper.get("title")), "snippet": _clean((item.get("snippet") or {}).get("text"))}
        return len(seen), list(seen.values())
    if index == "openalex":
        for item in data.get("results") or []:
            words = []  # type: List[Tuple[int, str]]
            for word, positions in (item.get("abstract_inverted_index") or {}).items():
                words.extend((position, word) for position in positions)
            source = ((item.get("primary_location") or {}).get("source") or {}).get("display_name") or ""
            works.append(
                {
                    "id": work_id(item.get("doi"), None, "openalex:" + str(item.get("id", "")).rsplit("/", 1)[-1]),
                    "openalex": str(item.get("id", "")).rsplit("/", 1)[-1],
                    "title": _clean(item.get("title")),
                    "authors": [(a.get("author") or {}).get("display_name", "") for a in item.get("authorships") or []],
                    "date": item.get("publication_date") or "",
                    "venue": source,
                    "abstract": " ".join(word for _, word in sorted(words)),
                    "cited_by": item.get("cited_by_count"),
                }
            )
        return (data.get("meta") or {}).get("count"), works
    if index == "crossref":
        message = data.get("message") or {}
        for item in message.get("items") or []:
            parts = ((item.get("issued") or {}).get("date-parts") or [[None]])[0]
            works.append(
                {
                    "id": work_id(item.get("DOI"), None, ""),
                    "title": _clean(" ".join(item.get("title") or [])),
                    "authors": [_clean("{} {}".format(a.get("given", ""), a.get("family", ""))) for a in item.get("author") or []],
                    "date": "-".join("{:02d}".format(p) if i else str(p) for i, p in enumerate(parts) if p),
                    "venue": _clean(" ".join(item.get("container-title") or [])),
                    "abstract": _clean(item.get("abstract")),
                }
            )
        return message.get("total-results"), works
    hits = (data.get("result") or {}).get("hits") or {}
    for hit in hits.get("hit") or []:
        info = hit.get("info") or {}
        authors = (info.get("authors") or {}).get("author") or []
        authors = authors if isinstance(authors, list) else [authors]
        works.append(
            {
                "id": work_id(info.get("doi"), None, "dblp:" + str(info.get("key", ""))),
                "title": _clean(info.get("title")),
                "authors": [a.get("text", "") if isinstance(a, dict) else str(a) for a in authors],
                "date": str(info.get("year") or ""),
                "venue": _clean(info.get("venue") if isinstance(info.get("venue"), str) else " ".join(info.get("venue") or [])),
                "abstract": "",
            }
        )
    total = hits.get("@total")
    return (int(total) if total is not None else None), works


def run_query(
    index: str,
    mode: str,
    query: str,
    out: Path,
    year_from: Optional[int] = None,
    limit: int = 25,
    sort: str = "relevance",
    key: Optional[str] = None,
    who: str = "",
    mail: str = "",
    getter: Getter = http_get,
    now: Callable[[], float] = time.time,
    sleep: Callable[[float], None] = time.sleep,
    pace: Optional[Path] = None,
) -> Tuple[Optional[int], List[dict]]:
    """Answer one query, log it and merge its works into the corpus. Raise SearchError when it fails.

    `pace` is the shared pacing directory, by default the one of this user. The survey directory `out` holds the
    log and the corpus with their own locks.
    """
    out.mkdir(parents=True, exist_ok=True)
    files = Pacer(out, now, sleep)
    pace_dir = pace or default_pace_dir()
    pace_dir.mkdir(parents=True, exist_ok=True)
    pacer = Pacer(pace_dir, now, sleep)
    entry = {
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now())),
        "who": who,
        "index": index,
        "mode": mode,
        "query": query,
        "year_from": year_from,
        "sort": sort,
        "keyed": bool(key),
    }

    def log(**fields: object) -> None:
        line = json.dumps(dict(entry, **fields), ensure_ascii=False) + "\n"

        def append() -> None:
            with open(out / "query-log.jsonl", "a", encoding="utf-8") as handle:
                handle.write(line)

        files.exclusive("log", append)

    if index in NEEDS_KEY and not key:
        log(status="failed", reason="no key file")
        raise SearchError(
            "{} refuses searches without a key. Pass --key-file with the path that the vault "
            "delivered. No request was sent.".format(index)
        )
    headers = {"User-Agent": "research-evidence/1.0" + (" (mailto:{})".format(mail) if mail else "")}
    if key and index == "semanticscholar":
        headers["x-api-key"] = key
    elif key:
        headers["Authorization"] = "Bearer " + key
    rows = min(limit, SEMANTIC_MAX if mode == "semantic" else 100 if index not in ("arxiv",) else 50)
    works, total, start = [], None, 0  # type: List[dict], Optional[int], int
    while len(works) < limit:
        body = None
        reason = ""
        for attempt in range(MAX_ATTEMPTS):
            lane = index + "-semantic" if mode == "semantic" else index
            url, data = build_url(index, mode, query, year_from, sort, start, rows, mail), request_body(index, mode, query)
            if lane in SINGLE_CONNECTION:
                status, payload, wait = pacer.connection(lane, lambda: getter(url, headers, data))
            else:
                pacer.wait_turn(lane)
                status, payload, wait = getter(url, headers, data)
            if status == 200:
                body = payload
                break
            reason = "HTTP {}".format(status) if status else "no answer"
            if status in (429, 503) or status == 0:
                default = 2.0 ** (attempt + 1)
                pacer.push_back(lane, min(wait if wait is not None else default, MAX_WAIT))
                if wait is not None and wait > MAX_WAIT:
                    reason += ", the index asks to wait {:.0f} s".format(wait)
                    break
                continue
            break
        if body is None:
            log(status="failed", reason=reason)
            raise SearchError("{} did not answer ({}).".format(index, reason))
        try:
            total, page = parse(index, body)
        except (ValueError, KeyError, ElementTree.ParseError) as error:
            log(status="failed", reason="unreadable answer")
            raise SearchError("{} returned an unreadable answer.".format(index)) from error
        works.extend(page)
        start += rows
        if index == "semanticscholar" or mode == "semantic" or len(page) < rows or (total is not None and start >= total):
            break
    works = [work for work in works[:limit] if work["id"]]
    label = "{}:{}:{}".format(index, mode, query)

    def merge() -> None:
        corpus = out / "corpus.jsonl"
        records = {}  # type: Dict[str, dict]
        if corpus.exists():
            for line in corpus.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    record = json.loads(line)
                    records[record["id"]] = record
        for work in works:
            record = records.setdefault(work["id"], dict(work, queries=[]))
            for field, value in work.items():
                if value and not record.get(field):
                    record[field] = value
            if label not in record["queries"]:
                record["queries"].append(label)
        temporary = corpus.with_suffix(".tmp")
        temporary.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records.values()), encoding="utf-8")
        # Sync clients such as OneDrive hold a file open for a moment after it changes, and Windows then refuses the replace.
        for attempt in range(20):
            try:
                os.replace(temporary, corpus)
                break
            except PermissionError:
                if attempt == 19:
                    raise
                time.sleep(0.5)

    # Snippet hits carry no identifier but the Semantic Scholar corpus ID. The caller resolves them to works first.
    if mode != "snippet":
        files.exclusive("corpus", merge)
    log(status="ok", hits=total, returned=len(works))
    return total, works


def unscreened(out: Path) -> Tuple[int, List[dict]]:
    """Return the corpus size and the corpus records that screening.jsonl has no decision for."""
    records = []  # type: List[dict]
    corpus = out / "corpus.jsonl"
    if corpus.exists():
        records = [json.loads(line) for line in corpus.read_text(encoding="utf-8").splitlines() if line.strip()]
    decided = set()
    screening = out / "screening.jsonl"
    if screening.exists():
        for line in screening.read_text(encoding="utf-8").splitlines():
            if line.strip():
                decided.add(json.loads(line).get("id"))
    return len(records), [record for record in records if record["id"] not in decided]


def emit(lines: List[str]) -> None:
    # Titles hold characters that a Windows pipe's default encoding rejects.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    try:
        print("\n".join(lines))
        sys.stdout.flush()
    except OSError:
        # The reader closed the pipe, as `head` does. The log and the corpus are already written.
        try:
            os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        except (OSError, ValueError, AttributeError):
            pass


def main(argv: Optional[List[str]] = None, getter: Getter = http_get) -> int:
    parser = argparse.ArgumentParser(description="Search a literature index into a survey directory")
    parser.add_argument(
        "mode", choices=("search", "semantic", "citing", "cited", "related", "lookup", "snippet", "papers", "unscreened"),
        help="semantic, citing, cited, related and lookup need --index openalex, snippet and papers --index semanticscholar. citing, cited and related take an OpenAlex ID as the query, lookup DOIs separated by |, papers IDs such as CorpusId:123 separated by commas. unscreened lists corpus records without a decision in screening.jsonl",
    )
    parser.add_argument("--index", choices=INDEXES)
    parser.add_argument("--query", help="search words, arXiv field syntax, or an OpenAlex work ID such as W2741809807")
    parser.add_argument("--out", required=True, help="survey directory: query-log.jsonl, corpus.jsonl and the shared pacing state")
    parser.add_argument("--year-from", type=int)
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--sort", choices=("relevance", "date"), default="relevance")
    parser.add_argument("--key-file", help="file that holds the index key, as the vault delivers it")
    parser.add_argument("--who", default="", help="agent name for the query log")
    args = parser.parse_args(argv)
    if args.mode == "unscreened":
        total, open_records = unscreened(Path(args.out))
        lines = ["{} of {} corpus records have no screening decision.".format(len(open_records), total)]
        for record in open_records[: max(1, args.limit)]:
            lines.append("- {} | {} | {}\n  abstract: {}".format(record["id"], record.get("date", ""), record.get("title", ""), record.get("abstract") or "none"))
        emit(lines)
        return 0
    if not args.index or not args.query:
        parser.error("{} needs --index and --query".format(args.mode))
    s2_modes = ("snippet", "papers")
    if (args.mode in s2_modes) != (args.index == "semanticscholar") or (args.mode not in s2_modes + ("search",) and args.index != "openalex"):
        parser.error("{} does not work with --index {}".format(args.mode, args.index))
    key = Path(args.key_file).read_text(encoding="utf-8").strip() if args.key_file else None
    try:
        total, works = run_query(
            args.index, args.mode, args.query, Path(args.out), args.year_from, max(1, min(args.limit, 200)), args.sort,
            key, args.who, os.environ.get("UNPAYWALL_EMAIL", ""), getter,
        )
    except SearchError as error:
        print("FAILED {} {}: {} A failed query is no evidence that nothing exists.".format(args.index, args.mode, error), file=sys.stderr)
        return EXIT_FAILED
    lines = ["OK {} {} {!r}: {} hits in the index, {} returned".format(args.index, args.mode, args.query, total, len(works))]
    for work in works:
        lines.append(
            "- {} | {} | {} | {} | abstract: {}".format(
                work["id"], work.get("date", ""), work.get("title", ""), work.get("venue", ""), "yes" if work.get("abstract") else "no"
            )
        )
    emit(lines)
    return 0


if __name__ == "__main__":
    sys.exit(main())
