import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True

PLUGIN_ROOT = Path(os.environ.get("PERSONAL_PLUGIN_DIR", Path(__file__).parents[1] / "plugin"))
SCRIPT = PLUGIN_ROOT / "skills" / "research-evidence" / "scripts" / "survey.py"
SPEC = importlib.util.spec_from_file_location("survey", SCRIPT)
survey = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(survey)

PLAN = {
    "descriptions": ["d1"],
    "keywords": ["k1"],
    "criteria": [{"name": "topic", "description": "on topic"}, {"name": "method", "description": "uses a model"}],
}


def work(identifier, title, abstract="an abstract", openalex=None):
    return {"id": identifier, "title": title, "abstract": abstract, "openalex": openalex or "W" + identifier.split(":")[-1].replace(".", "")}


class Index:
    """Answers (index, mode, query) from a table, records every call and merges results into the corpus like the helper."""

    out = None  # set per test to the survey directory

    def __init__(self, table, fail=None):
        self.table, self.fail, self.calls = table, fail, []

    def __call__(self, index, mode, query, limit, sort):
        self.calls.append((index, mode, query))
        if self.fail and self.fail == (index, mode):
            raise survey.SearchError("HTTP 429")
        works = list(self.table.get((index, mode, query), []))
        corpus = Index.out / "corpus.jsonl"
        Index.out.mkdir(parents=True, exist_ok=True)
        known = {json.loads(line)["id"] for line in corpus.read_text().splitlines()} if corpus.exists() else set()
        with open(corpus, "a") as handle:
            for w in works:
                if w["id"] not in known:
                    handle.write(json.dumps(w) + "\n")
                    known.add(w["id"])
        return works


async def plan(question):
    return PLAN


async def screen(records, plan):
    # A title containing CORE meets both criteria, REL is worth reading, the rest neither.
    return {r["id"]: {"criteria": ["CORE" in r["title"]] * 2, "read": "REL" in r["title"]} for r in records}


def run(out, index, known=(), budget=survey.BUDGET):
    return asyncio.run(survey.survey("q", out, index, plan, screen, known, budget))


class SurveyTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.out = Path(self.directory.name) / "s"
        Index.out = self.out

    def tearDown(self):
        self.directory.cleanup()

    def decisions(self):
        return {json.loads(line)["id"]: json.loads(line)["decision"] for line in (self.out / "screening.jsonl").read_text().splitlines()}

    def test_every_record_is_decided_and_one_without_abstract_stays_undecided(self):
        index = Index({
            ("openalex", "semantic", "d1"): [work("doi:1", "CORE a"), work("doi:2", "REL b"), work("doi:3", "c")],
            ("openalex", "search", "k1"): [work("doi:4", "CORE d", abstract="")],
        })
        run(self.out, index)
        self.assertEqual(self.decisions(), {"doi:1": "core", "doi:2": "related", "doi:3": "rejected", "doi:4": "undecided"})

    def test_rounds_end_when_a_round_adds_fewer_than_two_core_works(self):
        index = Index({
            ("openalex", "semantic", "d1"): [work("doi:1", "CORE a")],
            ("openalex", "citing", "W1"): [work("doi:2", "CORE b"), work("doi:3", "CORE c")],
            ("openalex", "citing", "W2"): [work("doi:4", "CORE d")],
        })
        numbers = run(self.out, index)
        self.assertEqual([r["new_core"] for r in numbers["rounds"]], [1, 2, 1])
        self.assertTrue(numbers["stopped"].startswith("saturation"))
        self.assertIn(("openalex", "cited", "W1"), index.calls)
        self.assertIn(("openalex", "related", "W1"), index.calls)

    def test_expansion_round_screens_works_reached_by_most_core_works_first(self):
        index = Index({
            ("openalex", "semantic", "d1"): [work("doi:1", "CORE a"), work("doi:2", "CORE b")],
            ("openalex", "citing", "W1"): [work("doi:shared", "REL s"), work("doi:only1", "REL o")],
            ("openalex", "citing", "W2"): [work("doi:shared", "REL s"), work("doi:only2", "REL p")],
        })
        cap, survey.ROUND_CAP = survey.ROUND_CAP, 1
        try:
            numbers = run(self.out, index)
        finally:
            survey.ROUND_CAP = cap
        round_one = [i for i, d in self.decisions().items() if i.startswith("doi:only") or i == "doi:shared"]
        self.assertEqual(round_one, ["doi:shared"])
        self.assertEqual(numbers["pending"], 2)

    def test_budget_ends_the_survey_and_says_so(self):
        index = Index({("openalex", "semantic", "d1"): [work("doi:{}".format(i), "CORE {}".format(i)) for i in range(5)]})
        numbers = run(self.out, index, budget=3)
        self.assertEqual(len(self.decisions()), 3)
        self.assertIn("budget", numbers["stopped"])

    def test_overlap_of_first_round_channels_gives_an_estimate(self):
        semantic = [work("doi:s{}".format(i), "CORE s{}".format(i)) for i in range(24)]
        keyword = semantic[:9] + [work("doi:k{}".format(i), "CORE k{}".format(i)) for i in range(10)]
        index = Index({("openalex", "semantic", "d1"): semantic, ("openalex", "search", "k1"): keyword})
        numbers = run(self.out, index)
        self.assertEqual(numbers["first_round"], {"semantic": 24, "keyword": 19, "both": 9, "estimate": 51})

    def test_disjoint_channels_report_unknown_coverage(self):
        index = Index({("openalex", "semantic", "d1"): [work("doi:1", "CORE a")], ("arxiv", "search", "k1"): [work("arxiv:2", "CORE b")]})
        run(self.out, index)
        self.assertIn("coverage is unknown", (self.out / "coverage.md").read_text())

    def test_known_work_missed_by_the_harvest_is_reported_and_then_added(self):
        index = Index({
            ("openalex", "semantic", "d1"): [work("doi:1", "CORE a")],
            ("openalex", "lookup", "10.48550/arxiv.2507.11687"): [work("arxiv:2507.11687", "CORE known")],
        })
        numbers = run(self.out, index, known=["doi:1", "arxiv:2507.11687"])
        self.assertEqual(numbers["known"], {"doi:1": True, "arxiv:2507.11687": False})
        self.assertEqual(self.decisions()["arxiv:2507.11687"], "core")

    def test_failed_channel_stops_the_survey_without_coverage(self):
        index = Index({("openalex", "semantic", "d1"): [work("doi:1", "CORE a")]}, fail=("arxiv", "search"))
        with self.assertRaises(survey.SurveyBlocked) as caught:
            run(self.out, index)
        self.assertIn("no evidence that nothing exists", str(caught.exception))
        self.assertFalse((self.out / "coverage.md").exists())

    def test_overview_continues_to_an_exhaustive_search_without_planning_or_harvesting_again(self):
        chain = {("openalex", "semantic", "d1"): [work("doi:1", "CORE a")]}
        for i in range(1, 5):
            chain[("openalex", "citing", "W{}".format(i))] = [work("doi:{}{}".format(i, j), "CORE {}{}".format(i, j)) for j in range(2)]
            for j in range(2):
                chain[("openalex", "citing", "W{}{}".format(i, j))] = [work("doi:{}{}{}".format(i, j, k), "CORE x") for k in range(2)]
        index = Index(chain)
        overview = asyncio.run(survey.survey("q", self.out, index, plan, screen, rounds=1))
        self.assertIn("did not saturate", (self.out / "coverage.md").read_text())
        harvest_calls = [c for c in index.calls if c[1] in ("semantic", "search") and c[2] in ("d1", "k1")]

        async def no_plan(question):
            raise AssertionError("the plan must be reused")

        exhaustive = asyncio.run(survey.survey("q", self.out, index, no_plan, screen, rounds=4))
        self.assertEqual([c for c in index.calls if c[1] in ("semantic", "search") and c[2] in ("d1", "k1")], harvest_calls)
        self.assertEqual([r["round"] for r in exhaustive["rounds"]][: len(overview["rounds"])], [r["round"] for r in overview["rounds"]])
        self.assertGreater(len(exhaustive["rounds"]), len(overview["rounds"]))

    def test_web_find_is_screened_and_marked(self):
        index = Index({
            ("openalex", "semantic", "d1"): [work("doi:1", "CORE a")],
            ("openalex", "lookup", "10.9/web"): [work("doi:10.9/web", "CORE web")],
        })
        run(self.out, index)
        numbers = asyncio.run(survey.add(self.out, ["doi:10.9/web"], index, screen))
        self.assertEqual(numbers["web"], ["doi:10.9/web"])
        self.assertEqual(self.decisions()["doi:10.9/web"], "core")


if __name__ == "__main__":
    unittest.main()
