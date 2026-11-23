# Design

## Context

See [proposal.md](proposal.md) for the motivation and [evidence.md](evidence.md) for the measurements. The accepted `research-evidence` spec keeps systematic-review procedures out of ordinary computer-science searches, and an earlier change made metadata repairs lighter because one heavy workflow for everything cost too much. The plugin ships one helper so far, `fetch_pdf.py`, as a standard-library Python script with fixture tests and an entry in the release asset list. The plugin must not own a service, a host setting or an OMP patch.

## Goals / Non-Goals

**Goals:**

- A coverage question gets searches whose reach can be read afterwards.
- Index queries survive parallel subagents.
- The report separates what was not found from what could not be searched.
- Ordinary evidence work stays as light as it is.

**Non-Goals:**

- A systematic review with a protocol, inclusion criteria agreed in advance or inter-rater checks.
- Ranking or summarizing works. The agent reads and judges.
- A permanent trial harness in the repository.
- Semantic Scholar as an index.

## Decisions

1. Add a second skill instead of a mode inside `research-evidence`. The accepted scenario that ordinary searches run without systematic-review procedures stays true as written. Subagents that only read papers load the evidence skill and not the survey procedure. The survey skill has its own description, so coverage wording selects it. A mode in the same file would make every reader load the survey text and would need that scenario weakened.
2. Ship the search as a Python script beside the skill, `scripts/search_index.py`. The session's tool lived in one kernel and ended with the session, so it cannot be tested or reused. An MCP server would add a process and host configuration, which the plugin must not own, and the setup uses none. A script matches the existing helper and its tests.
3. Share pacing through a state directory. Each index has a lock file that holds the earliest time of its next request, and every invocation with the same directory waits on it. The survey's output directory is the default state directory, so all agents of one survey share it. Pacing inside one process is not enough, because subagents run their own processes.
4. Query four indexes: OpenAlex with the key, the arXiv API, Crossref and DBLP. OpenAlex gives abstracts, date and venue filters and citation links at a tenth of the price of a search. arXiv gives the newest preprints by category. Crossref matches loosely, so it serves titles and DOIs more than topics, and the skill says so. DBLP lists a venue's papers.
5. Keep the web search as a required channel. In the measured survey it showed a third of the cited works that no index query showed. The helper does not wrap it, because the harness already logs web searches in the transcript.
6. Write the corpus as one JSON record per line, and keep screening decisions in a second file keyed by the record's identifier. A later harvest then extends the corpus without touching decisions, and parallel agents do not rewrite one file.
7. Require an output directory and name no default. The skill tells the agent to use the repository's research folder or a synced folder, because a temporary directory is deleted.
8. Fan out reading and screening, and let subagents search only through the helper. The skill tells the main agent to harvest first and to hand corpus records to subagents.
9. Take the report sections from the session's reports: how the search was done, what is established, what was not found, the queries, and how much of each work was read and by whom.
10. Use `UNPAYWALL_EMAIL` as the contact address that Crossref asks polite clients to send. It is the identity the host already provides.
11. Stop instead of degrading. A search of a billing index without a key fails in the helper, and a channel that cannot run stops the survey until the person removes the block or says to go on without it. The measured survey ran a whole day without OpenAlex, although a key that takes two minutes to store would have restored it. A report that names the missing channel afterwards does not undo that.

## Evaluation

A script, a skill text and their use in real work fail in different ways, so each gets its own check.

- The helper gets fixture tests: spacing with an injected clock, a throttled request that succeeds on retry, the failed status after the last attempt, paging up to the requested count, one corpus record for a work from two indexes, a log without the key, and two processes that share a state directory against a local server that records request times. The release-tree tests fail when the helper is missing.
- The skill gets real trials with fresh subagents, each run once with the released plugin and once with the candidate, with the same model, the same turn budget and a fixed cutoff date.
  - Canary questions: the history holds eight conclusions that nothing existed on a question, which a later search overturned. Each question goes to a fresh agent. The works that overturned the conclusion are the canaries. The candidate passes when it surfaces every canary that the baseline surfaces and states no gap that a canary contradicts.
  - Reference sets: two questions of the measured survey are run again. The result is compared with the works that survey cited. Recall of that set is reported, and the person judges a sample of the works that are new.
  - Process: each trial's files show index, web and citation-link searches, a decision with a reason for every screened record, no gap statement that rests on a failed query, and the reading depth and reader of every cited work.
- After four weeks of use the history measurement runs again. It reports the corrections on reach and screening per month, the share of surveys with a query log, the share of failed index calls and the share of cited works per channel.

The canary questions and reference sets come from private research sessions. They stay outside this repository, and `evidence.md` records counts.

## Risks / Trade-offs

- Two skills can both match a request about literature. Mitigation: the descriptions separate individual works from coverage questions, the evidence skill points to the survey skill, and the trials include a single-citation task that must not start a survey.
- The canaries were found by this same toolchain, and a model may know them. A passed trial shows that the workflow finds known works, not that a survey is complete.
- The reference sets come from the old way of searching, so recall against them favors that way. The judged sample of new works balances it.
- A lock file can stay behind after a crash. Mitigation: the lock holds a time, not an owner, so a stale file delays one request and then expires.
- Index interfaces and prices change. The helper logs the status and the reported cost of every query, so a change shows in the log.
- A paced survey is slower than a parallel one. The measured tool answered 369 queries in 58 minutes.
- The trials spend model budget on about 20 agent runs.

## Open Questions

- OpenAlex offers a semantic search for paragraph-length queries at one request per second. Whether it joins the index channel can be decided after the trials show what keyword search misses.
- The private canary list needs a home. The notes vault and a synced folder both work.
