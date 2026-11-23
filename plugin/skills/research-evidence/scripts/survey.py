#!/usr/bin/env python3
"""Run a literature survey as a program: plan, harvest, screen every record, expand kept works, count coverage.

Load it in the eval Python kernel and pass the kernel's `completion` and `judge_batch`:

    import importlib.util
    spec = importlib.util.spec_from_file_location("survey", "<path>/survey.py")
    survey = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(survey)
    summary = await survey.run(question, out_dir, key_file=key_path, completion=completion, judge_batch=judge_batch)

The model calls are injected so that the procedure runs the same way in tests.
"""

import asyncio
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
from typing import Awaitable, Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple

sys.dont_write_bytecode = True
_SPEC = importlib.util.spec_from_file_location("search_index", Path(__file__).with_name("search_index.py"))
search_index = importlib.util.module_from_spec(_SPEC)
assert _SPEC.loader is not None
_SPEC.loader.exec_module(search_index)
SearchError = search_index.SearchError

# Works looked up per full-text query. Semantic Scholar allows one request per second.
FULLTEXT_PAPERS = 40
# A round that adds fewer core works than this ends the survey as saturated.
MIN_NEW_CORE = 2
MAX_ROUNDS = 4
EXPAND_PER_ROUND = 15
# Records screened per expansion round, most linked to core works first. Screening is the slow step.
ROUND_CAP = 300
BUDGET = 2500
# An overview maps a topic from what it finds and claims nothing about what is missing: one citation hop, a small budget.
# An exhaustive search runs until saturation. A statement that something does not exist or is new needs it.
# Both use the same directory, so an overview can be continued to an exhaustive search.
# keyword: OpenAlex keyword results per query, arxiv: arXiv results per query. An overview harvests less so that its budget
# leaves room for one citation hop.
DEPTHS = {
    "overview": {"rounds": 1, "budget": 1000, "keyword": 50, "arxiv": 25},
    "exhaustive": {"rounds": MAX_ROUNDS, "budget": BUDGET, "keyword": 100, "arxiv": 50},
}
FIRST_ROUND_CHANNELS = ("semantic", "keyword")

Search = Callable[[str, str, str, int, str], List[dict]]
Plan = Callable[[str], Awaitable[dict]]
# Receives records and the plan, returns per record id the criteria results and whether it is worth reading.
Screen = Callable[[List[dict], dict], Awaitable[Dict[str, dict]]]


class SurveyBlocked(RuntimeError):
    """A channel failed. The survey stops instead of reporting coverage without it."""


def _read_jsonl(path: Path) -> List[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _append_jsonl(path: Path, rows: Iterable[dict]) -> None:
    with open(path, "a", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


class State:
    """What the survey directory holds between calls: channels per work, decisions, rounds."""

    def __init__(self, out: Path, on_progress: Optional[Callable[[str], None]] = None):
        self.out = out
        self.on_progress = on_progress
        self.records = {r["id"]: r for r in _read_jsonl(out / "corpus.jsonl")}
        self.channels = {}  # type: Dict[str, Set[str]]
        for row in _read_jsonl(out / "channels.jsonl"):
            self.channels.setdefault(row["id"], set()).add(row["channel"])
        self.decisions = {row["id"]: row for row in _read_jsonl(out / "screening.jsonl")}
        self.meta = json.loads((out / "survey.json").read_text(encoding="utf-8")) if (out / "survey.json").exists() else {}

    def progress(self, stage: str, message: str, **numbers: object) -> None:
        """Append one step to progress.jsonl, which anyone can follow, and pass the message to the caller."""
        row = dict({"at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "stage": stage, "message": message}, **numbers)
        _append_jsonl(self.out / "progress.jsonl", [row])
        if self.on_progress:
            self.on_progress(message)

    def note(self, works: Sequence[dict], channel: str, round_no: int) -> None:
        rows = []
        for work in works:
            self.records.setdefault(work["id"], dict(work))
            for field, value in work.items():
                if value and not self.records[work["id"]].get(field):
                    self.records[work["id"]][field] = value
            if channel not in self.channels.setdefault(work["id"], set()):
                self.channels[work["id"]].add(channel)
                rows.append({"id": work["id"], "channel": channel, "round": round_no})
        _append_jsonl(self.out / "channels.jsonl", rows)

    def undecided(self) -> List[dict]:
        return [r for i, r in self.records.items() if i not in self.decisions]

    def decide(self, rows: List[dict]) -> None:
        for row in rows:
            self.decisions[row["id"]] = row
        _append_jsonl(self.out / "screening.jsonl", rows)

    def core(self) -> Set[str]:
        return {i for i, d in self.decisions.items() if d["decision"] == "core"}

    def save_meta(self) -> None:
        (self.out / "survey.json").write_text(json.dumps(self.meta, indent=2, ensure_ascii=False), encoding="utf-8")


def _decision(record_id: str, verdict: Optional[dict], criteria: List[dict], round_no: int) -> dict:
    if verdict is None:
        return {"id": record_id, "decision": "undecided", "reason": "the screening model gave no answer", "round": round_no}
    met = [c["name"] for c, ok in zip(criteria, verdict["criteria"]) if ok]
    missed = [c["name"] for c, ok in zip(criteria, verdict["criteria"]) if not ok]
    decision = "core" if not missed else "related" if verdict["read"] else "rejected"
    reason = "meets: {}".format(", ".join(met) or "none") + ("; misses: {}".format(", ".join(missed)) if missed else "")
    return {"id": record_id, "decision": decision, "reason": reason, "round": round_no}


async def _screen_round(state: State, plan: dict, screen: Screen, budget_left: int, round_no: int) -> Tuple[int, bool]:
    """Decide the records that have none, most linked first. Returns the new core works and whether the budget stopped it.

    The first round screens the whole harvest. An expansion round screens at most ROUND_CAP records, ordered by how many
    core works reached them, and leaves the rest pending, which the coverage numbers count.
    """
    pending = state.undecided()
    without_abstract = [r for r in pending if not (r.get("abstract") or "").strip()]
    state.decide(
        [{"id": r["id"], "decision": "undecided", "reason": "no abstract", "round": round_no} for r in without_abstract]
    )
    links = state.meta.get("links", {})
    todo = sorted((r for r in pending if (r.get("abstract") or "").strip()), key=lambda r: -links.get(r["id"], 0))
    over_budget = len(todo) > budget_left
    cap = budget_left if round_no == 0 else min(budget_left, ROUND_CAP)
    todo = todo[: max(cap, 0)]
    before = state.core()
    if todo:
        state.progress("screen", "Round {}: screening {} records".format(round_no, len(todo)), round=round_no, records=len(todo))
        verdicts = await screen(todo, plan)
        state.decide([_decision(r["id"], verdicts.get(r["id"]), plan["criteria"], round_no) for r in todo])
    new_core = len(state.core() - before)
    state.progress("screened", "Round {}: {} new core works, {} core in total".format(round_no, new_core, len(state.core())), round=round_no, new_core=new_core)
    return new_core, over_budget


def _search(search: Search, state: State, channel: str, round_no: int, index: str, mode: str, query: str, limit: int, sort: str = "relevance") -> List[dict]:
    try:
        works = search(index, mode, query, limit, sort)
    except SearchError as error:
        raise SurveyBlocked("{} search failed: {} A failed channel is no evidence that nothing exists.".format(channel, error)) from error
    state.note(works, channel, round_no)
    state.progress("search", "{} {} {}: {} works".format(channel, index, mode, len(works)), round=round_no, channel=channel, returned=len(works))
    return works


def _openalex_id(search: Search, state: State, record: dict, round_no: int) -> Optional[str]:
    if record.get("openalex"):
        return record["openalex"]
    identifier = record["id"]
    doi = "10.48550/arxiv." + identifier[6:] if identifier.startswith("arxiv:") else identifier[4:] if identifier.startswith("doi:") else None
    if not doi:
        return None
    for work in _search(search, state, "lookup", round_no, "openalex", "lookup", doi, 5):
        if work["id"] == identifier and work.get("openalex"):
            state.records[identifier]["openalex"] = work["openalex"]
            return work["openalex"]
    return None


def _expand(search: Search, state: State, round_no: int) -> int:
    expanded = set(state.meta.setdefault("expanded", []))
    links = state.meta.setdefault("links", {})
    targets = [i for i in sorted(state.core()) if i not in expanded][:EXPAND_PER_ROUND]
    for identifier in targets:
        record = state.records[identifier]
        reached = set()  # type: Set[str]
        openalex = _openalex_id(search, state, record, round_no)
        if openalex:
            reached.update(w["id"] for w in _search(search, state, "references", round_no, "openalex", "cited", openalex, 100))
            reached.update(w["id"] for w in _search(search, state, "citing", round_no, "openalex", "citing", openalex, 100))
            reached.update(w["id"] for w in _search(search, state, "related", round_no, "openalex", "related", openalex, 50))
        seed = "{}. {}".format(record.get("title", ""), record.get("abstract", ""))
        reached.update(w["id"] for w in _search(search, state, "similar", round_no, "openalex", "semantic", seed, 50))
        # A work that several core works reach is more likely relevant, so it is screened first.
        for work_id in reached:
            links[work_id] = links.get(work_id, 0) + 1
        expanded.add(identifier)
    state.meta["expanded"] = sorted(expanded)
    return len(targets)


def coverage(state: State) -> dict:
    core = state.core()
    by_channel = {}  # type: Dict[str, int]
    for identifier in core:
        for channel in state.channels.get(identifier, ()):
            by_channel[channel] = by_channel.get(channel, 0) + 1
    first = {c: core & set(state.meta.get("first_round", {}).get(c, [])) for c in FIRST_ROUND_CHANNELS}
    semantic, keyword = first["semantic"], first["keyword"]
    both = semantic & keyword
    estimate = round(len(semantic) * len(keyword) / len(both)) if both else None
    counts = {}  # type: Dict[str, int]
    for d in state.decisions.values():
        counts[d["decision"]] = counts.get(d["decision"], 0) + 1
    return {
        "records": len(state.records),
        "pending": len(state.undecided()),
        "decisions": counts,
        "core_by_channel": dict(sorted(by_channel.items())),
        "first_round": {"semantic": len(semantic), "keyword": len(keyword), "both": len(both), "estimate": estimate},
        "rounds": state.meta.get("rounds", []),
        "stopped": state.meta.get("stopped"),
        "known": state.meta.get("known", {}),
        "web": sorted(i for i in core if "web" in state.channels.get(i, ())),
        "fulltext": state.meta.get("fulltext", False),
        "fulltext_unresolved": state.meta.get("fulltext_unresolved", 0),
    }


def coverage_markdown(numbers: dict, state: State) -> str:
    first = numbers["first_round"]
    lines = [
        "# How the search was done",
        "",
        "Channels: OpenAlex semantic search, OpenAlex keyword search, arXiv search{}{}.".format(
            ", Semantic Scholar full-text snippet search" if numbers.get("fulltext") else "",
            ", and for every core work its references, citing works, related works and a semantic search seeded with it"
            if len(numbers["rounds"]) > 1
            else ". No citation expansion ran",
        ),
        "" if numbers.get("fulltext") else "Semantic Scholar full-text snippet search did not run, because no key file was given.",
        "",
        "| Measure | Value |",
        "|---|---|",
        "| Records collected | {} |".format(numbers["records"]),
        "| Records left unscreened, reached by fewer core works than those screened | {} |".format(numbers["pending"]),
    ]
    for decision in ("core", "related", "rejected", "undecided"):
        lines.append("| Records {} | {} |".format(decision, numbers["decisions"].get(decision, 0)))
    for channel, count in numbers["core_by_channel"].items():
        lines.append("| Core works found by {} | {} |".format(channel, count))
    lines.append("| Core works per round | {} |".format(", ".join(str(r["new_core"]) for r in numbers["rounds"])))
    lines.append("| Ended because | {} |".format(numbers["stopped"]))
    if numbers.get("fulltext"):
        lines.append("| Full-text hits that could not be looked up | {} |".format(numbers["fulltext_unresolved"]))
    lines.append("")
    if first["estimate"] is None:
        lines.append(
            "In the first round semantic search found {} core works and keyword search {}, with none in common. No estimate of the total is possible, so coverage is unknown.".format(
                first["semantic"], first["keyword"]
            )
        )
    else:
        lines.append(
            "In the first round semantic search found {} core works and keyword search {}, {} of them both. If the two channels were independent, about {} such works would exist. They are correlated, so the real number is likely higher.".format(
                first["semantic"], first["keyword"], first["both"], first["estimate"]
            )
        )
    if numbers["known"]:
        lines += ["", "Known works given before the search:", ""]
        for identifier, found in sorted(numbers["known"].items()):
            lines.append("- {}: {}".format(identifier, "found by the search" if found else "missed by the search"))
    if numbers["web"]:
        lines += ["", "Core works found only through the web: {}".format(", ".join(numbers["web"]))]
    if numbers["rounds"] and numbers["rounds"][-1].get("saturated"):
        lines += ["", "A work not listed was not found by these channels. That is no evidence that it does not exist.", ""]
    else:
        lines += [
            "",
            "The search did not saturate. It shows what exists, and supports no statement that something does not exist or is new. Running it again with depth exhaustive in the same directory continues it.",
            "",
        ]
    return "\n".join(lines)


def _write_outputs(state: State) -> dict:
    numbers = coverage(state)
    (state.out / "coverage.json").write_text(json.dumps(numbers, indent=2, ensure_ascii=False), encoding="utf-8")
    (state.out / "coverage.md").write_text(coverage_markdown(numbers, state), encoding="utf-8")
    kept = ["# Kept works", ""]
    for decision in ("core", "related"):
        kept += ["## {}".format(decision.capitalize()), ""]
        for identifier in sorted(i for i, d in state.decisions.items() if d["decision"] == decision):
            record = state.records.get(identifier, {})
            kept.append("- {} | {} | {} | {}".format(identifier, record.get("date", ""), record.get("title", ""), state.decisions[identifier]["reason"]))
        kept.append("")
    (state.out / "kept.md").write_text("\n".join(kept), encoding="utf-8")
    return numbers


async def survey(
    question: str,
    out: Path,
    search: Search,
    plan: Plan,
    screen: Screen,
    known: Sequence[str] = (),
    budget: int = BUDGET,
    fulltext: bool = False,
    rounds: int = MAX_ROUNDS,
    progress: Optional[Callable[[str], None]] = None,
    harvest_sizes: Tuple[int, int] = (100, 50),
) -> dict:
    """Run or continue the survey in `out`. Raises SurveyBlocked when a channel fails, before any coverage is written.

    A directory that already holds a survey keeps its plan, harvest and decisions, and the rounds continue from there.
    That lets an overview grow into an exhaustive search, and an interrupted run lose only its unsaved screening batch.
    """
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    state = State(out, progress)
    if (out / "plan.json").exists():
        the_plan = json.loads((out / "plan.json").read_text(encoding="utf-8"))
    else:
        the_plan = await plan(question)
        (out / "plan.json").write_text(json.dumps(dict(the_plan, question=question), indent=2, ensure_ascii=False), encoding="utf-8")
    if "first_round" not in state.meta:
        await _harvest(search, state, the_plan, known, fulltext, harvest_sizes)
    rounds_done = state.meta.setdefault("rounds", [])
    if rounds_done and rounds_done[-1].get("saturated"):
        return _write_outputs(state)
    screened = sum(r["screened"] for r in rounds_done)
    round_no = len(rounds_done)
    while True:
        if round_no > 0 and state.meta.get("expanded_round", 0) < round_no:
            if not _expand(search, state, round_no):
                state.meta["stopped"] = "no core work left to expand"
                break
            state.meta["expanded_round"] = round_no
            state.save_meta()
        before = len(state.decisions)
        new_core, over_budget = await _screen_round(state, the_plan, screen, budget - screened, round_no)
        screened += len(state.decisions) - before
        saturated = round_no > 0 and new_core < MIN_NEW_CORE and not over_budget
        rounds_done.append({"round": round_no, "new_core": new_core, "screened": len(state.decisions) - before, "saturated": saturated})
        state.save_meta()
        if over_budget:
            state.meta["stopped"] = "the screening budget of {} records was spent before saturation".format(budget)
            break
        if saturated:
            state.meta["stopped"] = "saturation: round {} added {} core works".format(round_no, new_core)
            break
        if round_no >= rounds:
            state.meta["stopped"] = "the limit of {} expansion round{}, before saturation".format(rounds, "" if rounds == 1 else "s")
            break
        round_no += 1
    state.save_meta()
    state.progress("done", "Stopped: {}".format(state.meta.get("stopped")))
    return _write_outputs(state)


async def _harvest(search: Search, state: State, the_plan: dict, known: Sequence[str], fulltext: bool, sizes: Tuple[int, int]) -> None:
    first = {"semantic": set(), "keyword": set()}  # type: Dict[str, Set[str]]
    for description in the_plan["descriptions"]:
        first["semantic"].update(w["id"] for w in _search(search, state, "semantic", 0, "openalex", "semantic", description, 50))
    state.meta["fulltext"] = fulltext
    if fulltext:
        hit_ids = []  # type: List[str]
        for description in the_plan["descriptions"]:
            try:
                hits = search("semanticscholar", "snippet", description, 100, "relevance")
            except SearchError as error:
                raise SurveyBlocked("fulltext search failed: {} A failed channel is no evidence that nothing exists.".format(error)) from error
            hit_ids.extend(h["s2"] for h in hits[:FULLTEXT_PAPERS] if h["s2"] not in hit_ids)
            state.progress("search", "fulltext snippets: {} papers".format(len(hits)), round=0, channel="fulltext-hits", returned=len(hits))
        # Snippet hits name only a Semantic Scholar corpus ID. One batch request returns their identifiers and abstracts.
        found = []  # type: List[dict]
        for start in range(0, len(hit_ids), 500):
            batch = ",".join("CorpusId:" + i for i in hit_ids[start : start + 500])
            found += _search(search, state, "fulltext", 0, "semanticscholar", "papers", batch, 500)
        state.meta["fulltext_unresolved"] = len(hit_ids) - len(found)
    for query in the_plan["keywords"]:
        first["keyword"].update(w["id"] for w in _search(search, state, "keyword", 0, "openalex", "search", query, sizes[0]))
        first["keyword"].update(w["id"] for w in _search(search, state, "keyword", 0, "arxiv", "search", query, sizes[1], "date"))
    harvested = set(state.records)
    state.meta["known"] = {k: k in harvested for k in known}
    missing = [k for k in known if k not in harvested]
    dois = ["10.48550/arxiv." + k[6:] if k.startswith("arxiv:") else k[4:] for k in missing if k.startswith(("arxiv:", "doi:"))]
    if dois:
        _search(search, state, "known", 0, "openalex", "lookup", "|".join(dois), len(dois))
    # Saved last, so that an interrupted harvest runs again in full.
    state.meta["first_round"] = {c: sorted(ids) for c, ids in first.items()}
    state.save_meta()


async def add(out: Path, identifiers: Sequence[str], search: Search, screen: Screen) -> dict:
    """Add works found on the web, screen them like every other record and recount coverage."""
    out = Path(out)
    state = State(out)
    the_plan = json.loads((out / "plan.json").read_text(encoding="utf-8"))
    dois = ["10.48550/arxiv." + k[6:] if k.startswith("arxiv:") else k[4:] for k in identifiers if k.startswith(("arxiv:", "doi:"))]
    if dois:
        _search(search, state, "web", len(state.meta.get("rounds", [])), "openalex", "lookup", "|".join(dois), len(dois))
    await _screen_round(state, the_plan, screen, len(dois), len(state.meta.get("rounds", [])))
    state.save_meta()
    return _write_outputs(state)


PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "descriptions": {"type": "array", "items": {"type": "string"}},
        "keywords": {"type": "array", "items": {"type": "string"}},
        "criteria": {
            "type": "array",
            "items": {"type": "object", "properties": {"name": {"type": "string"}, "description": {"type": "string"}}, "required": ["name", "description"]},
        },
    },
    "required": ["descriptions", "keywords", "criteria"],
}

PLAN_PROMPT = """Plan a literature search for this question.

Question: {question}

Return:
- descriptions: 3 to 5 paragraphs, each describing the kind of paper that answers the question in different words, as the paper's own abstract might. Use the terms of different communities: the task, the method, the artifact and neighbouring fields.
- keywords: 3 to 6 short keyword queries of 2 to 5 words each, in different vocabularies.
- criteria: 2 to 4 independent criteria that a relevant paper meets, each checkable from a title and abstract.
Do not name specific papers."""


def model_plan(completion: Callable) -> Plan:
    async def plan(question: str) -> dict:
        handle = completion(PLAN_PROMPT.format(question=question), model="default", schema=PLAN_SCHEMA)
        result = await asyncio.to_thread(handle.wait)
        if not result["descriptions"] or not result["keywords"] or not result["criteria"]:
            raise SurveyBlocked("the plan came back without descriptions, keywords or criteria")
        return result

    return plan


def model_screen(judge_batch: Callable, question: str) -> Screen:
    async def screen(records: List[dict], plan: dict) -> Dict[str, dict]:
        questions = {
            "c{}".format(i): {
                "type": "bool",
                "instructions": "Question being surveyed: {}\nCriterion '{}': {}\nDoes this paper meet the criterion, judging from its title and abstract?".format(
                    question, c["name"], c["description"]
                ),
            }
            for i, c in enumerate(plan["criteria"])
        }
        questions["read"] = {
            "type": "bool",
            "instructions": "Question being surveyed: {}\nShould a researcher answering this question read this paper? Answer yes if it addresses the question, even partly or in other terms.".format(
                question
            ),
        }
        states = {r["id"]: "Title: {}\nAbstract: {}".format(r.get("title", ""), r.get("abstract", "")) for r in records}
        batch = judge_batch(states, questions, intent="Screening {} survey records".format(len(states)))
        try:
            while batch.status().get("running"):
                await batch.drain(60)
            answers = batch.results()
        finally:
            batch.close()

        def yes(answer: dict, key: str) -> bool:
            return bool(((answer or {}).get(key) or {}).get("bool", 0) >= 0.5)

        return {
            rid: {"criteria": [yes(a, "c{}".format(i)) for i in range(len(plan["criteria"]))], "read": yes(a, "read")}
            for rid, a in answers.items()
        }

    return screen


def index_search(out: Path, key_file: str, s2_key_file: Optional[str] = None) -> Search:
    keys = {"openalex": Path(key_file).read_text(encoding="utf-8").strip()}
    if s2_key_file:
        keys["semanticscholar"] = Path(s2_key_file).read_text(encoding="utf-8").strip()
    mail = os.environ.get("UNPAYWALL_EMAIL", "")

    def search(index: str, mode: str, query: str, limit: int, sort: str) -> List[dict]:
        return search_index.run_query(index, mode, query, Path(out), None, limit, sort, keys.get(index), "survey", mail)[1]

    return search


async def run(
    question: str,
    out: str,
    key_file: str,
    completion: Callable,
    judge_batch: Callable,
    depth: str = "overview",
    known: Sequence[str] = (),
    s2_key_file: Optional[str] = None,
    progress: Optional[Callable[[str], None]] = None,
) -> dict:
    """Search `question` into `out`, a directory outside temporary folders.

    `depth` is "overview" to map a topic from what is found, about 5 to 10 minutes, or "exhaustive" for any statement
    about what does not exist or is new, which runs until saturation and takes 20 to 30 minutes. A second call on the
    same `out` continues the first, so an overview can be extended to an exhaustive search.
    `key_file` holds the OpenAlex key. `s2_key_file` holds the Semantic Scholar key and adds full-text snippet search.
    """
    limits = DEPTHS[depth]
    search = index_search(Path(out), key_file, s2_key_file)
    plan, screen = model_plan(completion), model_screen(judge_batch, question)
    return await survey(
        question, Path(out), search, plan, screen, known, limits["budget"], bool(s2_key_file), limits["rounds"], progress, (limits["keyword"], limits["arxiv"])
    )


async def add_web_finds(out: str, identifiers: Sequence[str], key_file: str, judge_batch: Callable) -> dict:
    """Screen works found on the web, given as doi:<doi> or arxiv:<id>, into the survey in `out`."""
    question = json.loads((Path(out) / "plan.json").read_text(encoding="utf-8"))["question"]
    return await add(Path(out), identifiers, index_search(Path(out), key_file), model_screen(judge_batch, question))


async def bench(canary_file: str, out_root: str, key_file: str, completion: Callable, judge_batch: Callable, s2_key_file: Optional[str] = None) -> List[dict]:
    """Run the survey on every question of a private canary file and report the stage each canary work reached.

    The file is a JSON list of {"key", "question", "works": {name: [identifier, title fragment]}}.
    """
    rows = []
    for case in json.loads(Path(canary_file).read_text(encoding="utf-8")):
        out = Path(out_root) / case["key"]
        await run(case["question"], str(out), key_file, completion, judge_batch, depth="exhaustive", s2_key_file=s2_key_file)
        state = State(out)
        for name, (identifier, fragment) in case["works"].items():
            matches = [i for i, r in state.records.items() if i == identifier or fragment.lower() in (r.get("title") or "").lower()]
            decisions = {state.decisions.get(i, {}).get("decision") for i in matches}
            stage = "core" if "core" in decisions else "related" if "related" in decisions else "candidates" if matches else "missed"
            rows.append({"question": case["key"], "work": name, "stage": stage})
    lines = ["| Question | Work | Stage |", "|---|---|---|"] + ["| {question} | {work} | {stage} |".format(**r) for r in rows]
    (Path(out_root) / "bench.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return rows
