import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

# Importing the helper must not write __pycache__ into the plugin payload or
# the installed release under test.
sys.dont_write_bytecode = True

PLUGIN_ROOT = Path(os.environ.get("PERSONAL_PLUGIN_DIR", Path(__file__).parents[1] / "plugin"))
SCRIPT = PLUGIN_ROOT / "skills" / "research-evidence" / "scripts" / "search_index.py"
SPEC = importlib.util.spec_from_file_location("search_index", SCRIPT)
search_index = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(search_index)

KEY = "sk-test-key-0123456789"


def openalex(*works, count=None):
    results = [
        {
            "id": "https://openalex.org/" + identifier,
            "doi": doi,
            "title": title,
            "publication_date": "2026-01-02",
            "authorships": [{"author": {"display_name": "Ada Example"}}],
            "primary_location": {"source": {"display_name": "Venue"}},
            "abstract_inverted_index": {"second": [1], "First": [0]},
            "cited_by_count": 3,
        }
        for identifier, doi, title in works
    ]
    return json.dumps({"meta": {"count": count if count is not None else len(results)}, "results": results}).encode()


def crossref(*works):
    items = [{"DOI": doi, "title": [title], "issued": {"date-parts": [[2026, 1]]}} for doi, title in works]
    return json.dumps({"message": {"total-results": len(items), "items": items}}).encode()


class Clock:
    def __init__(self):
        self.time = 1000.0
        self.sleeps = []

    def now(self):
        return self.time

    def sleep(self, seconds):
        self.sleeps.append(seconds)
        self.time += seconds


class Scripted:
    """Answer requests from a list and record when each one arrived."""

    def __init__(self, clock, answers):
        self.clock, self.answers, self.calls = clock, list(answers), []

    def __call__(self, url, headers, body=None):
        self.calls.append((self.clock.now(), url, dict(headers), body))
        return self.answers.pop(0)


class SearchIndexTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.out = Path(self.directory.name) / "survey"
        self.clock = Clock()

    def tearDown(self):
        self.directory.cleanup()

    def query(self, index, text, answers, **options):
        getter = Scripted(self.clock, answers)
        result = search_index.run_query(
            index, options.pop("mode", "search"), text, self.out, getter=getter,
            now=self.clock.now, sleep=self.clock.sleep, **options,
        )
        return result, getter

    def log(self):
        return [json.loads(line) for line in (self.out / "query-log.jsonl").read_text().splitlines()]

    def corpus(self):
        return [json.loads(line) for line in (self.out / "corpus.jsonl").read_text().splitlines()]

    def test_requests_to_one_index_keep_their_spacing(self):
        _, first = self.query("crossref", "a", [(200, crossref(("10.1/a", "A")), None)])
        _, second = self.query("crossref", "b", [(200, crossref(("10.1/b", "B")), None)])
        gap = second.calls[0][0] - first.calls[0][0]
        self.assertGreaterEqual(gap, search_index.SPACING["crossref"])

    def test_throttled_request_waits_as_told_and_succeeds(self):
        (total, works), getter = self.query(
            "crossref", "a", [(429, b"", 7.0), (200, crossref(("10.1/a", "A")), None)]
        )
        self.assertEqual(total, 1)
        self.assertEqual(len(getter.calls), 2)
        self.assertGreaterEqual(getter.calls[1][0] - getter.calls[0][0], 7.0)
        self.assertEqual(self.log()[-1]["status"], "ok")

    def test_semantic_scholar_backs_off_exponentially_and_tries_longer(self):
        snippet = json.dumps({"data": [{"paper": {"corpusId": "7", "title": "T"}, "snippet": {"text": "s"}}]}).encode()
        answers = [(429, b"", None)] * 4 + [(200, snippet, None)]
        (_, works), getter = self.query("semanticscholar", "q", answers, mode="snippet", key=KEY)
        gaps = [b[0] - a[0] for a, b in zip(getter.calls, getter.calls[1:])]
        self.assertEqual([round(g) for g in gaps], [2, 4, 8, 16])
        self.assertEqual(works[0]["s2"], "7")
        self.assertIn(("x-api-key", KEY), getter.calls[0][2].items())

    def test_query_fails_after_the_last_attempt_and_says_so(self):
        with self.assertRaises(search_index.SearchError):
            self.query("crossref", "a", [(429, b"", 1.0)] * search_index.MAX_ATTEMPTS)
        entry = self.log()[-1]
        self.assertEqual(entry["status"], "failed")
        self.assertFalse((self.out / "corpus.jsonl").exists())

    def test_a_wait_of_hours_fails_at_once(self):
        with self.assertRaises(search_index.SearchError) as raised:
            _, getter = self.query("crossref", "a", [(429, b"", 30000.0)])
        self.assertIn("asks to wait", str(raised.exception))
        self.assertEqual(self.clock.sleeps, [])

    def test_empty_result_is_ok_and_distinct_from_failure(self):
        (total, works), _ = self.query("crossref", "nothing", [(200, crossref(), None)])
        self.assertEqual((total, works), (0, []))
        self.assertEqual(self.log()[-1]["status"], "ok")

    def test_paging_collects_up_to_the_limit(self):
        pages = [
            (200, openalex(*[("W{}".format(i), "https://doi.org/10.1/p{}".format(i), "T") for i in range(100)], count=250), None),
            (200, openalex(*[("W{}".format(i), "https://doi.org/10.1/p{}".format(i), "T") for i in range(100, 200)], count=250), None),
        ]
        (total, works), getter = self.query("openalex", "topic", pages, limit=150, key=KEY)
        self.assertEqual(total, 250)
        self.assertEqual(len(works), 150)
        self.assertIn("page=2", getter.calls[1][1])

    def test_one_work_from_two_indexes_is_one_record_with_both_queries(self):
        self.query("openalex", "topic", [(200, openalex(("W1", "https://doi.org/10.1/Same", "Same work")), None)], key=KEY)
        self.query("crossref", "same work", [(200, crossref(("10.1/same", "Same work")), None)])
        records = self.corpus()
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["id"], "doi:10.1/same")
        self.assertEqual(records[0]["abstract"], "First second")
        self.assertEqual(len(records[0]["queries"]), 2)

    def test_arxiv_doi_and_arxiv_identifier_are_the_same_work(self):
        self.assertEqual(
            search_index.work_id("https://doi.org/10.48550/arXiv.2401.00001", None, "x"),
            search_index.work_id(None, "2401.00001v3", "y"),
        )

    def test_key_goes_into_a_header_and_never_into_the_url_or_the_log(self):
        _, getter = self.query("openalex", "topic", [(200, openalex(("W1", None, "T")), None)], key=KEY)
        _, url, headers, _ = getter.calls[0]
        self.assertEqual(headers["Authorization"], "Bearer " + KEY)
        self.assertNotIn(KEY, url)
        self.assertNotIn(KEY, (self.out / "query-log.jsonl").read_text())
        self.assertTrue(self.log()[-1]["keyed"])

    def test_billing_index_without_a_key_sends_no_request(self):
        getter = Scripted(self.clock, [])
        with self.assertRaises(search_index.SearchError) as raised:
            search_index.run_query("openalex", "search", "topic", self.out, getter=getter, now=self.clock.now, sleep=self.clock.sleep)
        self.assertEqual(getter.calls, [])
        self.assertIn("key", str(raised.exception))
        self.assertEqual(self.log()[-1]["reason"], "no key file")

    def test_citing_works_use_the_citation_filter(self):
        _, getter = self.query("openalex", "W123", [(200, openalex(("W9", None, "Citer")), None)], mode="citing", key=KEY)
        self.assertIn("cites%3AW123", getter.calls[0][1])

    def test_semantic_search_sends_plain_words_in_one_page_of_at_most_fifty(self):
        works = [("W{}".format(i), None, "T{}".format(i)) for i in range(50)]
        (_, returned), getter = self.query(
            "openalex", 'Does code "match" guidelines? (yes, no)', [(200, openalex(*works), None)], mode="semantic", key=KEY, limit=200
        )
        self.assertEqual(len(getter.calls), 1)
        self.assertIn("search.semantic=Does+code+match+guidelines+yes+no", getter.calls[0][1])
        self.assertIn("per-page=50", getter.calls[0][1])
        self.assertEqual(len(returned), 50)

    def test_semantic_scholar_batch_posts_ids_and_maps_them_to_dois_and_preprints(self):
        papers = json.dumps([
            {"externalIds": {"CorpusId": 1, "DOI": "10.1/A"}, "title": "A", "abstract": "x"},
            None,
            {"externalIds": {"CorpusId": 3, "ArXiv": "2507.11687"}, "title": "B", "abstract": "y"},
        ]).encode()
        (_, works), getter = self.query("semanticscholar", "CorpusId:1,CorpusId:2,CorpusId:3", [(200, papers, None)], mode="papers", key=KEY, limit=500)
        self.assertEqual(json.loads(getter.calls[0][3]), {"ids": ["CorpusId:1", "CorpusId:2", "CorpusId:3"]})
        self.assertEqual([w["id"] for w in works], ["doi:10.1/a", "arxiv:2507.11687"])

    def test_related_and_lookup_use_their_filters(self):
        _, related = self.query("openalex", "W5", [(200, openalex(("W6", None, "R")), None)], mode="related", key=KEY)
        _, lookup = self.query("openalex", "10.1/a|10.1/b", [(200, openalex(("W7", "10.1/a", "L")), None)], mode="lookup", key=KEY)
        self.assertIn("related_to%3AW5", related.calls[0][1])
        self.assertIn("doi%3A10.1%2Fa%7C10.1%2Fb", lookup.calls[0][1])

    def test_command_reports_failure_as_no_evidence_of_absence(self):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            status = search_index.main(
                ["search", "--index", "openalex", "--query", "topic", "--out", str(self.out)],
                getter=Scripted(self.clock, []),
            )
        self.assertEqual(status, 2)
        self.assertIn("no evidence that nothing exists", stderr.getvalue())

    def test_a_closed_pipe_after_the_search_is_still_success(self):
        class Closed(io.StringIO):
            def write(self, text):
                raise BrokenPipeError(22, "closed")

        with contextlib.redirect_stdout(Closed()):
            status = search_index.main(
                ["search", "--index", "crossref", "--query", "topic", "--out", str(self.out)],
                getter=Scripted(self.clock, [(200, crossref(("10.1/a", "A")), None)]),
            )
        self.assertEqual(status, 0)
        self.assertEqual(len((self.out / "query-log.jsonl").read_text(encoding="utf-8").splitlines()), 1)

    def test_unscreened_lists_only_records_without_a_decision(self):
        self.query("crossref", "a", [(200, crossref(("10.1/a", "A"), ("10.1/b", "B")), None)])
        (self.out / "screening.jsonl").write_text(json.dumps({"id": "doi:10.1/a", "decision": "reject", "reason": "x"}) + "\n")
        total, open_records = search_index.unscreened(self.out)
        self.assertEqual((total, [record["id"] for record in open_records]), (2, ["doi:10.1/b"]))

    def test_log_entry_has_every_field(self):
        self.query("crossref", "a", [(200, crossref(("10.1/a", "A")), None)], year_from=2024, who="Scout", sort="date")
        entry = self.log()[-1]
        for field in ("at", "who", "index", "mode", "query", "year_from", "sort", "status", "hits", "returned", "keyed"):
            self.assertIn(field, entry)


class SharedPacingTests(unittest.TestCase):
    def test_two_processes_share_the_spacing_of_one_state_directory(self):
        arrivals = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                arrivals.append(time.time())
                body = crossref(("10.1/x", "X"))
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *arguments):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        program = (
            "import importlib.util, sys; from pathlib import Path; sys.dont_write_bytecode = True\n"
            "spec = importlib.util.spec_from_file_location('s', sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\n"
            "m.build_url = lambda *a: 'http://127.0.0.1:' + sys.argv[3] + '/'\n"
            "m.run_query('crossref', 'search', sys.argv[4], Path(sys.argv[2]))\n"
        )
        try:
            with tempfile.TemporaryDirectory() as directory:
                processes = [
                    subprocess.Popen([sys.executable, "-c", program, str(SCRIPT), directory, str(server.server_port), name])
                    for name in ("a", "b", "c")
                ]
                for process in processes:
                    self.assertEqual(process.wait(timeout=60), 0)
                records = (Path(directory) / "query-log.jsonl").read_text().splitlines()
        finally:
            server.shutdown()
        self.assertEqual(len(arrivals), 3)
        self.assertEqual(len(records), 3)
        gaps = [later - earlier for earlier, later in zip(sorted(arrivals), sorted(arrivals)[1:])]
        self.assertGreaterEqual(min(gaps), search_index.SPACING["crossref"] - 0.1)


if __name__ == "__main__":
    unittest.main()
