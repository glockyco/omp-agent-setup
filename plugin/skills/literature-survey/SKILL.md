---
name: literature-survey
description: Survey what the literature holds on a topic with searches whose reach is recorded. Use for state of the art, prior art, novelty checks, "has anyone studied X", "what is being published on X" and how much exists on a topic. Not for a single citation, a DOI check or one paper's PDF, which the research-evidence skill covers.
---

# Literature survey

A survey answers what exists on a question and what these searches did not find. Individual works go through the `research-evidence` skill: acquisition, reading, metadata and registration.

When a channel or a key is blocked by something the person can remove, stop and ask for exactly that. A survey that goes on without a channel looks complete when it is not.

## Where the survey lives

Pick one survey directory in the repository's research folder or a synced documents folder, never a temporary directory. It holds the query log, the corpus, the screening decisions and the report. Every agent of the survey uses the same directory, because the helper paces requests through it.

## 1. Search three channels

Each question needs all three. They find different works.

One wording finds one community. Before you search, write down at least three ways the field could name the subject, such as the task, the method and the artifact. Search each in every channel. When a kept abstract uses a term you did not search, search that term too.

1. An index, through the bundled helper. Resolve `skill://literature-survey/scripts/search_index.py` to its path and run it with host Python 3:

   ```bash
   python3 "<path>/search_index.py" search --index <openalex|arxiv|crossref|dblp> --query "<query>" --out "<survey directory>" [--year-from 2023] [--limit 50] [--sort date] [--key-file "<path>"] [--who <agent name>]
   ```

   - `openalex`: abstracts, dates and venues. It needs `--key-file`. Get the path with `vault search private --query openalex` and `vault file`, as the research-evidence skill describes.
   - `arxiv`: the newest preprints. It accepts `abs:`, `ti:` and `cat:cs.SE` with `AND` and quoted phrases.
   - `crossref`: titles and DOIs of published work. It matches loosely, so use it for names and phrases more than for topics.
   - `dblp`: computer-science venues and authors, without abstracts. On some networks it answers scripts with a challenge and the query fails. Then use `openalex` for the same venue or author.
2. The web, with `web_search`, once for every naming and again for every new term. It shows works that the indexes rank low or do not hold yet. Note each query for the report.
3. Citation links of every work you keep as close to the question, as soon as you know it. Works that name the subject differently turn up here and nowhere else:

   ```bash
   python3 "<path>/search_index.py" citing --index openalex --query <OpenAlex ID such as W2741809807> --out "<survey directory>" --key-file "<path>"
   python3 "<path>/search_index.py" cited  --index openalex --query <OpenAlex ID> --out "<survey directory>" --key-file "<path>"
   ```

The helper appends every query to `query-log.jsonl` and merges the works into `corpus.jsonl`, one record per work with its abstract and the queries that returned it. It prints `OK` with the hit count, or `FAILED` with exit status 2. A failed query is no evidence that nothing exists: fix the cause, run it again or ask.

Search the indexes only through the helper. Direct calls from several agents get the whole network address throttled.

## 2. Screen

Every record in the corpus gets a decision, because the works that answer the question under another name sit among those you did not search for. Decide on title and abstract, never on the title alone and never by keywords. Write each decision to `screening.jsonl` in the survey directory as `{"id", "decision", "reason"}` with `keep`, `reject` or `undecided`. The reason says in a few words what the work does, such as "survey of SQL generation from text", so that a reader can check the decision. A record without an abstract gets one from another index or the work's page, or stays `undecided`.

List the records that still lack a decision, with their abstracts, in batches:

```bash
python3 "<path>/search_index.py" unscreened --out "<survey directory>" --limit 40
```

Screening is done when it reports 0 records without a decision. Searches that you add later add records, so run it again before the report.

## 3. Read

Hand kept works to the `research-evidence` skill. Subagents can screen and read in parallel. Give each one records from the corpus and the survey directory, and have it report how much of each work it read.

## 4. Report

Write the report into the survey directory with these parts:

- How it was checked: the three channels and whether each ran, the number of queries, the date range, the failures, and how many corpus records were screened.
- What is established, with a link for every work.
- What was not found. Say "not found by these queries", and name the channels that ran.
- How much of each cited work was read, and by whom: you, a named subagent, or nobody beyond the abstract.
- Limits, and what to search again before a claim goes into a paper.
