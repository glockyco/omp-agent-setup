import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock

# Importing the helper must not write __pycache__ into the plugin payload or
# the installed release under test.
sys.dont_write_bytecode = True


PLUGIN_ROOT = Path(os.environ.get("PERSONAL_PLUGIN_DIR", Path(__file__).parents[1] / "plugin"))
SCRIPT = PLUGIN_ROOT / "skills" / "research-evidence" / "scripts" / "fetch_pdf.py"
SPEC = importlib.util.spec_from_file_location("fetch_pdf", SCRIPT)
fetch_pdf = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(fetch_pdf)


class FixtureGetter:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    def __call__(self, url, accept, referer, timeout):
        self.calls.append((url, accept, referer, timeout))
        response = self.responses.get(url)
        if isinstance(response, Exception):
            raise response
        if response is None:
            raise fetch_pdf.AcquisitionError("fixture missing: {}".format(url))
        return response


class FetchPdfTests(unittest.TestCase):
    doi = "10.1000/example"
    api = "https://api.unpaywall.org/v2/10.1000/example?email=writer@example.org"

    def unpaywall(self, publisher=None, repository=None):
        locations = []
        if publisher:
            locations.append(
                {
                    "host_type": "publisher",
                    "version": "publishedVersion",
                    "url_for_pdf": publisher,
                }
            )
        if repository:
            locations.append(
                {
                    "host_type": "repository",
                    "version": "acceptedVersion",
                    "url_for_pdf": repository,
                }
            )
        return json.dumps({"is_oa": True, "oa_locations": locations}).encode()

    def test_publisher_precedes_every_later_source(self):
        getter = FixtureGetter(
            {
                self.api: self.unpaywall("https://publisher.test/paper.pdf", "https://repo.test/paper.pdf"),
                "https://publisher.test/paper.pdf": b"%PDF-publisher",
            }
        )
        data, source = fetch_pdf.acquire(
            self.doi,
            "2401.00001",
            "writer@example.org",
            getter,
            ("https://sci.test",),
        )
        self.assertEqual(data, b"%PDF-publisher")
        self.assertEqual(source, "OA publisher https://publisher.test/paper.pdf")
        self.assertEqual(len(getter.calls), 2)

    def test_scihub_resolves_relative_viewer_url_after_publisher_rejection(self):
        viewer = "https://sci.test/{}".format(self.doi)
        getter = FixtureGetter(
            {
                self.api: self.unpaywall("https://publisher.test/not-pdf", "https://repo.test/paper.pdf"),
                "https://publisher.test/not-pdf": b"<html>blocked</html>",
                viewer: b'<html><meta content="/downloads/paper.pdf" name="citation_pdf_url"></html>',
                "https://sci.test/downloads/paper.pdf": b"%PDF-scihub",
            }
        )
        data, source = fetch_pdf.acquire(
            self.doi,
            None,
            "writer@example.org",
            getter,
            ("https://sci.test",),
        )
        self.assertEqual(data, b"%PDF-scihub")
        self.assertEqual(source, "sci-hub https://sci.test")
        self.assertEqual(getter.calls[-1][2], viewer)
        self.assertNotIn("https://repo.test/paper.pdf", [call[0] for call in getter.calls])

    def test_repository_precedes_arxiv_when_scihub_has_no_pdf(self):
        viewer = "https://sci.test/{}".format(self.doi)
        getter = FixtureGetter(
            {
                self.api: self.unpaywall(repository="https://repo.test/paper.pdf"),
                viewer: b"<html>metadata only</html>",
                "https://repo.test/paper.pdf": b"%PDF-repository",
            }
        )
        data, source = fetch_pdf.acquire(
            self.doi,
            "2401.00001",
            "writer@example.org",
            getter,
            ("https://sci.test",),
        )
        self.assertEqual(data, b"%PDF-repository")
        self.assertEqual(source, "OA repository https://repo.test/paper.pdf")
        self.assertNotIn("https://arxiv.org/pdf/2401.00001", [call[0] for call in getter.calls])

    def test_arxiv_is_last_automated_source(self):
        getter = FixtureGetter({"https://arxiv.org/pdf/2401.00001": b"%PDF-arxiv"})
        data, source = fetch_pdf.acquire(None, "2401.00001", None, getter, ())
        self.assertEqual(data, b"%PDF-arxiv")
        self.assertEqual(source, "arxiv https://arxiv.org/pdf/2401.00001")

    def test_non_pdf_bytes_are_rejected(self):
        getter = FixtureGetter({"https://arxiv.org/pdf/2401.00001": b"<html>viewer</html>"})
        self.assertEqual(fetch_pdf.acquire(None, "2401.00001", None, getter, ()), (None, None))

    def test_unpaywall_requires_explicit_email_before_network(self):
        getter = FixtureGetter({})
        with self.assertRaisesRegex(fetch_pdf.AcquisitionError, "UNPAYWALL_EMAIL"):
            fetch_pdf.acquire(self.doi, None, None, getter, ())
        self.assertEqual(getter.calls, [])


class FetchPdfResultTests(unittest.TestCase):
    """The printed result and exit status are what an agent acts on."""

    doi = "10.1000/example"
    api = "https://api.unpaywall.org/v2/10.1000/example?email=writer@example.org"

    def run_main(self, arguments, responses):
        getter = FixtureGetter(responses)
        stdout, stderr = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "paper.pdf"
            with (
                mock.patch.dict(os.environ, {"UNPAYWALL_EMAIL": "writer@example.org"}),
                contextlib.redirect_stdout(stdout),
                contextlib.redirect_stderr(stderr),
            ):
                status = fetch_pdf.main(["key", *arguments, "--out", str(output)], getter, ())
            saved = output.read_bytes() if output.exists() else None
        return status, stdout.getvalue(), stderr.getvalue(), saved

    def lookup(self, genre):
        location = {"host_type": "repository", "url_for_pdf": "https://repo.test/paper.pdf"}
        return json.dumps({"is_oa": True, "genre": genre, "oa_locations": [location]}).encode()

    def test_published_doi_with_only_a_repository_copy_is_a_manuscript(self):
        status, out, _, saved = self.run_main(
            ["--doi", self.doi],
            {self.api: self.lookup("proceedings-article"), "https://repo.test/paper.pdf": b"%PDF-repository"},
        )
        self.assertEqual(status, 3)
        self.assertTrue(out.startswith("MANUSCRIPT key:"))
        self.assertIn("published version was not obtained", out)
        self.assertEqual(saved, b"%PDF-repository")

    def test_published_doi_with_only_an_arxiv_copy_is_a_manuscript(self):
        status, out, _, saved = self.run_main(
            ["--doi", self.doi, "--arxiv", "2401.00001"],
            {
                self.api: json.dumps({"is_oa": False, "genre": "journal-article"}).encode(),
                "https://arxiv.org/pdf/2401.00001": b"%PDF-arxiv",
            },
        )
        self.assertEqual(status, 3)
        self.assertTrue(out.startswith("MANUSCRIPT key:"))
        self.assertEqual(saved, b"%PDF-arxiv")

    def test_posted_content_from_a_repository_is_an_ordinary_success(self):
        status, out, _, saved = self.run_main(
            ["--doi", self.doi],
            {self.api: self.lookup("posted-content"), "https://repo.test/paper.pdf": b"%PDF-repository"},
        )
        self.assertEqual(status, 0)
        self.assertTrue(out.startswith("OK key:"))
        self.assertEqual(saved, b"%PDF-repository")

    def test_arxiv_doi_is_an_ordinary_success(self):
        api = "https://api.unpaywall.org/v2/10.48550/arXiv.2401.00001?email=writer@example.org"
        status, out, _, _ = self.run_main(
            ["--doi", "10.48550/arXiv.2401.00001", "--arxiv", "2401.00001"],
            {api: fetch_pdf.AcquisitionError("not found"), "https://arxiv.org/pdf/2401.00001": b"%PDF-arxiv"},
        )
        self.assertEqual(status, 0)
        self.assertTrue(out.startswith("OK key:"))

    def test_failed_lookup_is_named_and_later_sources_are_still_tried(self):
        status, _, err, saved = self.run_main(
            ["--doi", self.doi, "--arxiv", "2401.00001"],
            {self.api: fetch_pdf.AcquisitionError("timed out")},
        )
        self.assertEqual(status, 1)
        self.assertIn("open-access lookup failed", err)
        self.assertNotIn("publisher OA", err)
        self.assertNotIn("repository OA", err)
        self.assertIn("arXiv", err)
        self.assertIsNone(saved)

    def test_work_without_open_access_copy_lists_the_sources_tried(self):
        status, _, err, _ = self.run_main(
            ["--doi", self.doi],
            {self.api: json.dumps({"is_oa": False, "genre": "journal-article"}).encode()},
        )
        self.assertEqual(status, 1)
        self.assertIn("publisher OA, Sci-Hub, repository OA", err)
        self.assertNotIn("lookup failed", err)


if __name__ == "__main__":
    unittest.main()
