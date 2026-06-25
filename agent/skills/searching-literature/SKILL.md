---
name: searching-literature
description: Use when finding papers for a writing repo — locating prior work on a topic, building or expanding a citation set, or resolving a paper's metadata, before acquiring its PDF. Covers OpenAlex/DBLP/Crossref search, citation-graph traversal, DOI verification, and screening by reading.
---

# Searching Literature

## Overview

The lightweight literature workflow: search with OpenAlex/DBLP, screen by reading
abstracts, then hand off to acquisition and registration. Three steps chain to
the other skills:

**search → acquire (`skill://retrieving-paper-pdfs`) → register (format per `skill://formatting-bibtex-entries`, into the repo's bib file)**

Metadata always comes from an authoritative source — never fabricate it. Never
characterize a paper without reading at least its abstract and method section.

## Search APIs

```bash
# OpenAlex keyword search — the CS field filter (fields/17) keeps out unrelated fields
curl -s 'https://api.openalex.org/works?search=QUERY&filter=primary_topic.field.id:fields/17,publication_year:2015-2026&per_page=100&select=title,publication_year,doi,primary_location,authorships,abstract_inverted_index'

# OpenAlex DOI lookup (verify metadata, get the OpenAlex id)
curl -s 'https://api.openalex.org/works/https://doi.org/DOI'

# OpenAlex forward citations (who cites X) — needs the OpenAlex id
curl -s 'https://api.openalex.org/works?filter=cites:OPENALEX_ID&per_page=200&select=title,publication_year,doi,authorships,abstract_inverted_index'

# OpenAlex backward citations (what X cites)
curl -s 'https://api.openalex.org/works/OPENALEX_ID?select=referenced_works'

# DBLP keyword search — paginate with &f=N
curl -s 'https://dblp.org/search/publ/api?q=QUERY&format=json&h=100&f=0'

# Crossref BibTeX (for the bibliography entry)
curl -s 'https://api.crossref.org/works/DOI/transform/application/x-bibtex'
```

The `read` tool resolves these URLs too. Reconstruct OpenAlex abstracts from the
`abstract_inverted_index` field.

## Verify DOIs

A wrong DOI traverses the wrong citation graph and corrupts the bibliography.
Before relying on a DOI, resolve it via OpenAlex and confirm the title and
authors match. (`10.1145/363347.363387` resolves to Thompson's 1968 regex paper,
not the program-differencing work it is sometimes mistaken for.)

## Screen by reading

Two passes, cheap before expensive:

1. **Title screen** — keep / reject / uncertain, one-line reason.
2. **Abstract screen** (survivors only) — read the abstract against the topic;
   for uncertain cases read the introduction and method section.

Citation-graph expansion (forward `cites:`, backward `referenced_works`) from a
confirmed-relevant paper is useful, but follow it only as far as it stays on
topic — there is no fixed protocol to complete.

## Acquire and register

- **Acquire** the PDF with the `skill://retrieving-paper-pdfs` skill.
- **Register** in the repo's bibliography file (see the repo's `AGENTS.md` / bib
  rule), formatting the entry per `skill://formatting-bibtex-entries`, with
  metadata from OpenAlex/Crossref/DBLP, and read the paper before characterizing it.

## Scope

This is the lightweight approach the writing repos use, replacing a heavier
snowballing protocol. There is no `protocol.yml`, no candidate CSVs, and no
multi-phase Human/LLM pipeline — search, read, acquire, register.
