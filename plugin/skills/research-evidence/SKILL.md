---
name: research-evidence
description: Find, screen, acquire, read, verify, characterize, and register computer-science and adjacent technical evidence. Use for literature searches, related work, paper PDFs, citation graphs, evidence for technical claims, DOI verification, and BibTeX additions or cleanup.
---

# Research and evidence

For a paper search, evidence claim, or paper characterization, use this workflow:

```text
search -> screen -> acquire -> read -> verify metadata -> register
```

For metadata-only DOI verification or bibliography maintenance, verify authoritative metadata and update the registration. Do not search for, acquire, or read full text unless that work is necessary to resolve the metadata.

Never fabricate metadata. Never characterize a paper without reading the relevant full text.

## 1. Search

Optimize the default search for computer science and adjacent technical literature. Use another domain-specific index only when the task or repository requires it.

Use authoritative indexes:

- OpenAlex for keyword search, abstracts, DOI lookup, and citation graphs;
- DBLP for computer-science publication search;
- Crossref for DOI metadata and BibTeX;
- the publisher and paper for final verification.

Useful endpoints:

```text
https://api.openalex.org/works?search=<query>
https://api.openalex.org/works/https://doi.org/<doi>
https://api.openalex.org/works?filter=cites:<openalex-id>
https://dblp.org/search/publ/api?q=<query>&format=json
https://api.crossref.org/works/<doi>/transform/application/x-bibtex
```

A wrong DOI corrupts acquisition and citation traversal. Confirm that the resolved title and authors match before use.

### OpenAlex key

OpenAlex bills searches and lists against a daily budget, and requests without a key share a small one per network address. Single-record lookups by DOI or OpenAlex ID cost nothing and need no key.

For searches and lists, send the key as a bearer token:

1. Find the entry with `vault search private --query openalex` and deliver its password with `vault file`. The result is the path of a private file.
2. Build the header from that file inside the command: `curl -sS -H "Authorization: Bearer $(cat "<path>")" "<url>"`.

Never put the key into a URL, a tool argument or a log. The vault blocks a call that contains it. If the vault holds no entry or refuses the delivery, look up single records without a key and report that searches may be refused.

### Hosts that refuse scripted requests

Do not request these hosts with `read`, `curl` or a script. They answer with an error or an empty page, and each attempt is wasted.

- ACM Digital Library (`dl.acm.org`), ScienceDirect (`sciencedirect.com`) and IEEE Xplore (`ieeexplore.ieee.org`): take title, venue and abstract from the OpenAlex record of the DOI, and get the full text through the acquisition order in step 3.
- ResearchGate and Google Scholar: use OpenAlex, DBLP or Crossref for the same work.
- OpenReview (`openreview.net`): pages and PDFs load only in a browser. Use the arXiv or proceedings copy of the work, or the browser relay.
- Semantic Scholar: it refuses most requests without a key. Use OpenAlex for citations and Unpaywall, through the helper, for open-access copies.

### Browser relay

The browser relay drives the person's own browser, which is signed in to the institution's subscriptions. It reaches the published version on the hosts above when no scripted route does. Open the page in eval with `browser.open({ app: "relay", url: "https://doi.org/<doi>" })`, read the article there or download its PDF, and close the tab afterwards.

Use the relay when a work is reachable only on a refusing host, and when the helper reports `MANUSCRIPT` or `FAIL` for a work that has a published version. If the relay is not connected or the page still shows a paywall, ask the person for the file.

## 2. Screen

1. Screen titles as keep, reject, or uncertain. Record one factual reason.
2. Read abstracts for survivors.
3. For uncertain papers, read the introduction and method.
4. Expand forward or backward citations only while results remain relevant.

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

The helper prints one of three results:

- `OK` with exit status 0: the file is saved and is the published version or a genuine preprint.
- `MANUSCRIPT` with exit status 3: the file is saved, but the DOI names a published work and only a repository or arXiv copy was found. Ask the person before citing from it. They may provide the published version.
- `FAIL` with exit status 1 or 2: no file. The message names the sources tried, a failed open-access lookup, or the missing configuration.

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
