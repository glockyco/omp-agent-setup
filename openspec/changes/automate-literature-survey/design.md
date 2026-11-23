# Design

## Context

Agents skipped parts of the survey procedure whenever it was prose. The procedure is predictable: plan, harvest, screen, expand, repeat, count. Only planning and screening need judgment.

## Decisions

- The program is a Python module, `survey.py`, in the research-evidence skill. An agent loads it in eval and awaits one call. Eval provides `completion` for planning and `judge_batch` for screening with the session's models, so the program needs no credentials of its own beyond the index keys.
- Index access stays in `search_index.py`, which keeps pacing, the query log, the corpus and the key handling. It gains OpenAlex semantic search and related works.
- Planning: one model call turns the question into three to five descriptions for semantic search, three to six keyword queries, and two to four criteria a relevant work meets. The criteria are written to `plan.json` so the person can check them.
- Harvest: each description runs as an OpenAlex semantic search, each keyword query as an OpenAlex keyword search and an arXiv search sorted by date.
- Screening: every record without a decision goes to `judge_batch` with one yes or no question per criterion and one on whether a researcher on the question should read it. A record meeting all criteria is core, one judged worth reading is related, the rest is rejected. Records without an abstract are undecided. Decisions go to `screening.jsonl` with the criteria results as the reason.
- Expansion: for each core work not expanded yet, the program fetches its references, its citing works, its related works, and a semantic search seeded with its title and abstract. Rounds continue until a round adds fewer than two core works, four rounds have run, or the screening budget is spent.
- Coverage: per channel the number of core works, the overlap of the semantic and keyword channels in the first round with a Lincoln-Petersen estimate, the core works each round added, failed queries, and for known works given by the person whether the harvest found them before they were added. The program writes `coverage.md`, which the report quotes.
- Web finds: `survey.add(out, ids)` looks works up, screens them and marks them as found on the web.
- The benchmark reads a private file of canary questions and works, runs the program per question and reports for each canary whether it reached the candidates, the core set and the related set.
- Depth follows what the answer will claim. An overview maps a topic from what it finds, with one expansion round and a budget of 600 records. An exhaustive search runs until saturation and is what a statement about absence or novelty needs. A second run on the same directory continues the first, so an overview can grow into an exhaustive search, and a run that a user message stops loses only its unsaved screening batch.
- With a Semantic Scholar key, snippet search over full text runs for each description, and one batch request resolves the hits to identifiers and abstracts. Semantic Scholar refuses a varying share of keyed requests, so the helper backs off exponentially over seven attempts.
- Every search and screening step goes to `progress.jsonl` and, when given, to a progress callback such as eval's `log`. A plugin tool that runs the survey as a background job with streamed progress is the next step, outside this change.

## Risks

- OpenAlex semantic search is new, returns at most 50 works per query and indexes new arXiv papers with delay. The arXiv channel covers the newest works.
- The small screening model lets off-topic works into the core set. Recall matters more here, and the reading agent drops them.
- The Lincoln-Petersen estimate assumes independent channels. Correlated channels make it too low, which the coverage section says.
