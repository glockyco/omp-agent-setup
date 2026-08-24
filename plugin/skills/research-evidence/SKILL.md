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

Run the bundled helper:

```bash
skill://research-evidence/scripts/fetch_pdf.py <key> --doi <doi> [--arxiv <id>] --out <path>
```

Set `UNPAYWALL_EMAIL` to a real contact address before DOI acquisition. The helper has a Nix-patched Python shebang and needs no ambient Python package installation.

Sci-Hub returns an HTML viewer. The helper extracts `citation_pdf_url` or an embedded PDF URL, resolves relative paths, and accepts bytes only when they start with `%PDF-`.

If automated acquisition fails, report the attempted source classes. Obtain an authorized author or institutional copy manually. Do not disguise HTML as a PDF.

## 4. Read

Read the text that supports each intended claim. For mechanism, method, limitation, or result claims, read the relevant body section. An abstract is enough only for abstract-level claims.

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
