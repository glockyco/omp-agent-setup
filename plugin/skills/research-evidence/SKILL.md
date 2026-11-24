---
name: research-evidence
description: Find, screen, acquire, read, verify, characterize, and register computer-science and adjacent technical evidence. Use for an overview of a topic, the state of the art, prior art, whether an idea has been studied, related work, a citation, paper PDFs, citation graphs, evidence for technical claims, DOI verification, and BibTeX additions or cleanup.
---

# Research and evidence

For a paper search, evidence claim, or paper characterization, use this workflow:

```text
search -> screen -> acquire -> read -> verify metadata -> register
```

For metadata-only DOI verification or bibliography maintenance, verify authoritative metadata and update the registration. Do not search for, acquire, or read full text unless that work is necessary to resolve the metadata.

Never fabricate metadata. Never characterize a paper without reading the relevant full text.

Questions about a topic, rather than about one work, start with the survey program in step 0.

When a step is blocked by something the person can remove, such as a vault approval, a missing key, a login or a host setting, stop that step and ask for exactly that. Never continue on a weaker source, a weaker copy or a search with less reach instead, because the result then looks complete when it is not.

## 0. Survey a topic

The survey program searches OpenAlex by meaning and by keyword and the newest arXiv works. Exhaustive searches also search Semantic Scholar's full text when its key is available. A small model screens the records against criteria derived from the question, and the program then follows the references, citing works, related works and similar works of every work that meets all criteria. It writes the corpus, the decisions, `kept.md` and `coverage.md` to the survey directory.

Choose the depth by what the answer will claim:

- `overview` maps a topic from what is found: the main lines of work, related work for a section, a first look. It takes one to two minutes. Its report may say what exists, never what is missing.
- `exhaustive` runs until a round adds almost nothing or 2,500 records are screened. A statement that nothing exists, that an idea is new or that a list is the state of the art needs a search that saturated. Search the exact claim as its own question, because a narrow question saturates and a broad one ends on the budget, and `coverage.md` then says that no such statement is supported.

A second run on the same directory continues the first, so start with an overview and extend it when the question turns into one about what is missing.

Pick a survey directory in the repository's research folder or a synced documents folder, never a temporary directory. Get the OpenAlex key file and, if the vault has one, the Semantic Scholar key file with `vault file` as described below. Then run in eval, Python:

```python
import importlib.util, sys
sys.dont_write_bytecode = True  # keeps __pycache__ out of the installed plugin
spec = importlib.util.spec_from_file_location("survey", "<path of skill://research-evidence/scripts/survey.py>")
survey = importlib.util.module_from_spec(spec); spec.loader.exec_module(survey)
summary = await survey.run("<the question as asked>", "<survey directory>", "<OpenAlex key file>", completion,
                           depth="overview", progress=log, s2_key_file="<Semantic Scholar key file or None>")
```

`progress=log` shows each search and screening step while the cell runs. The same steps go to `progress.jsonl` in the survey directory.

Pass works the person already knows as `known=["doi:...", "arxiv:..."]`. The coverage numbers then show whether the search found them on its own.

A message from the person while the cell runs can stop the kernel. Call `survey.run` again with the same arguments, and it continues. For an exhaustive search, a subagent can run it.

Afterwards:

1. Read `plan.json` and check that the criteria match the question. If they do not, start over in a new directory with the question stated more precisely.
2. Search the web for works the indexes may lack, such as the newest preprints and grey literature. Add each find with `await survey.add_web_finds("<survey directory>", ["doi:...", "arxiv:..."], "<OpenAlex key file>", completion)`.
3. Read the core works in `kept.md` with steps 3 to 6. Drop off-topic ones, since the screening model favours recall.
4. Quote `coverage.md` in the report: how the search was done, what each channel found and where it stopped. Phrase a gap as not found by these channels, and only after an exhaustive search. Say how much of each cited work was read, and by whom.

A failed channel stops the program with the reason. Fix the cause or ask the person, and never report coverage from a run without that channel.

## 1. Search

Optimize the default search for computer science and adjacent technical literature. Use another domain-specific index only when the task or repository requires it.

For a single work, look it up directly:

```text
https://api.openalex.org/works/https://doi.org/<doi>
https://dblp.org/search/publ/api?q=<title words>&format=json
https://api.crossref.org/works/<doi>/transform/application/x-bibtex
```

Run keyword searches, semantic searches and citation lists through the bundled helper, which paces requests, logs them and keeps the key out of logs: resolve `skill://research-evidence/scripts/search_index.py` and run `python3 "<path>" --help` for its modes. Direct searches from several agents get the network address throttled.

A wrong DOI corrupts acquisition and citation traversal. Confirm that the resolved title and authors match before use.

### Index keys

OpenAlex bills searches and lists against a daily budget. Semantic Scholar refuses almost every request without a key. Single-record lookups by DOI or OpenAlex ID cost nothing and need no key.

1. Find the entry with `vault search private --query openalex` or `--query "semantic scholar"` and deliver its password with `vault file`. The result is the path of a private file.
2. Pass that path to the helper with `--key-file`, or to the survey program. For a direct call, build the header inside the command: `curl -sS -H "Authorization: Bearer $(cat "<path>")" "<url>"`.

Never put a key into a URL, a tool argument or a log. The vault blocks a call that contains it. The first delivery of an entry needs the person's approval in an interactive session. If the vault holds no OpenAlex entry or refuses the delivery, stop and ask the person to add or approve the entry, and to allow it always when runs without a person need it. Without a Semantic Scholar key the survey runs without full-text search and says so.

### Hosts that refuse scripted requests

Do not request these hosts with `read`, `curl` or a script. They answer with an error or an empty page, and each attempt is wasted.

- ACM Digital Library (`dl.acm.org`), ScienceDirect (`sciencedirect.com`) and IEEE Xplore (`ieeexplore.ieee.org`): take title, venue and abstract from the OpenAlex record of the DOI, and get the full text through the acquisition order in step 3.
- ResearchGate and Google Scholar: use OpenAlex, DBLP or Crossref for the same work.
- OpenReview (`openreview.net`): pages and PDFs load only in a browser. Use the browser relay.
- Semantic Scholar's website: use its API through the helper with the key from the vault, or OpenAlex for the same work.

### Browser relay

The browser relay drives the person's own browser, which is signed in to the institution's subscriptions. It reaches the published version on the hosts above when no scripted route does. Open the page in eval with `browser.open({ app: "relay", url: "https://doi.org/<doi>" })`, read the article there or download its PDF, and close the tab afterwards.

Use the relay when a work is reachable only on a refusing host, when the helper reports `MANUSCRIPT` or `FAIL` for a work that has a published version, and when the helper cannot run because the host configuration is missing. If the relay is not connected or the page still shows a paywall, ask the person for the file.

## 2. Screen

1. Screen on title and abstract as keep, reject, or uncertain. Never reject on the title alone. Record one factual reason.
2. For uncertain papers, read the introduction and method.
3. Expand forward or backward citations only while results remain relevant.

## 3. Acquire

For DOI acquisition, use Unpaywall metadata to discover an official publisher-hosted open-access PDF. If the metadata provides none, continue to the next source.

Use this order:

1. publisher-hosted open-access published version;
2. Sci-Hub published version;
3. repository or green-open-access manuscript;
4. arXiv;
5. manual author or institutional copy.

The published version precedes a repository manuscript. arXiv is a source for genuine preprints or a last resort.

Run the readable bundled script explicitly with host-owned Python 3. Resolve
`skill://research-evidence/scripts/fetch_pdf.py` to its installed filesystem path
first, and quote that path (including spaces):

```bash
python3 "/installed cache/personal/skills/research-evidence/scripts/fetch_pdf.py" <key> --doi <doi> [--arxiv <id>] --out <path>
```

In native Windows PowerShell, use an explicit Python executable and the call operator:

```powershell
& "C:\path to Python\python.exe" "C:\installed cache\personal\skills\research-evidence\scripts\fetch_pdf.py" <key> --doi <doi> --out <path>
```

Use the actual resolved interpreter and script paths, not the example paths.
Python is an acquisition prerequisite supplied by the host; plugin discovery
does not require or install it. The helper uses only the Python standard library,
needs no ambient Python packages, and does not depend on a patched shebang or
Windows executable mode bits. Unix release assets retain their executable bits.
Take `UNPAYWALL_EMAIL` from the host environment only. If it is unset, do not set it in the command: stop and report the missing host configuration.

The helper prints one of four results:

- `OK` with exit status 0: the file is saved and is the published version or a genuine preprint.
- `MANUSCRIPT` with exit status 3: the file is saved, but the DOI names a published work and only a repository or arXiv copy was found. Ask the person before citing from it. They may provide the published version.
- `FAIL` with exit status 1: no source had the file. The message names the sources tried.
- `FAIL` with exit status 2: the helper could not start, because the address is missing or the open-access lookup failed. It tried no source. Fix the cause or run it again.

Sci-Hub returns an HTML viewer. The helper extracts `citation_pdf_url` or an embedded PDF URL, resolves relative paths, and accepts bytes only when they start with `%PDF-`.

If automated acquisition fails, report the attempted source classes. Obtain an authorized author or institutional copy manually. Do not disguise HTML as a PDF.

## 4. Read

Read the text that supports each intended claim. For mechanism, method, limitation, or result claims, read the relevant body section. An abstract is enough only for abstract-level claims.

Full text that an open host serves as HTML, such as an arXiv HTML page, counts as read text. Record the section, figure, table or quotation in place of a page, and name the version you read, such as `arXiv v2`. For a work that has a published version, the same rule as for a manuscript file applies: ask before citing from the preprint.

When a paper supports a claim, record:

- the supported claim;
- whether you read the full text;
- the supporting page, section, figure, table, or quotation;
- the relevant method or data;
- the relevant result;
- material limitations.

Omit fields that do not apply. Do not add empty placeholders.

## 5. Verify metadata

Take title, authors, venue, year, pages, and DOI from OpenAlex, Crossref, DBLP, the publisher, or the paper. Resolve conflicts against the published paper. Do not infer fields from memory, snippets, or filenames.

Before you register a preprint, look for its published version: the DBLP entry of the title, the locations of its OpenAlex record, and the journal reference and DOI of its arXiv record. Register the published version when one exists, and the preprint only when none does.

## 6. Register

Follow the repository's bibliography location, key, field, formatting, and ordering rules. These rules take precedence over the defaults below.

When the repository defines no applicable convention, use these BibTeX defaults:

- key: `author_year_keyword`;
- brace-protect acronyms, tool names, and proper nouns in titles;
- use full journal and conference names;
- remove `timestamp`, `biburl`, and `bibsource`;
- lowercase DOI values;
- use `--` for page ranges;
- drop a URL that only repeats the DOI;
- keep a URL when no DOI exists.

If a key changes, update every citation callsite in the same operation. Search again after the edit to prove that the old key is absent.

## Deterministic and live verification

Automated tests use local HTTP fixtures. They do not depend on Sci-Hub, Unpaywall, publishers, or arXiv. A release smoke can use configured live mirrors. A mirror-list change is a reviewed source change, not runtime configuration.
