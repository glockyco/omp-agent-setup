---
name: retrieving-paper-pdfs
description: Use when acquiring a paper's full-text PDF for a writing repo — the acquire step of the searching-literature workflow, before characterizing or citing a paper, or whenever a DOI or arXiv id is in hand and the PDF is not yet stored. Covers open-access, Sci-Hub, and arXiv retrieval, and why a plain curl of a Sci-Hub URL saves the wrong file.
---

# Retrieving Paper PDFs

## Overview

Goal: get the best canonical full-text PDF into the repo's PDF store (if it has one), then read it
before writing any characterization of it (the EVIDENCE rule). The trap: Sci-Hub and many publisher
pages return an HTML *viewer*, not the PDF. The real PDF URL lives in the page's
`<meta name="citation_pdf_url">` tag. Fetch that, and always validate that the first five bytes are
`%PDF-` before saving.

> **Never fabricate metadata.** Title, authors, venue, year, pages, and DOI for the bibliography
> entry MUST come from an authoritative source — OpenAlex, Crossref
> (`api.crossref.org/works/<DOI>/transform/application/x-bibtex`), or DBLP — and be verified against
> the paper. Reconstructing metadata from memory, a search snippet, or the PDF's own header is
> prohibited: a wrong year, venue, or normalized author name corrupts the citation graph and the
> bibliography.

## Source order

Prefer the most canonical copy that is actually retrievable. The published version beats a
repository preprint, so Sci-Hub comes before green OA.

| # | Source | What it gives | How |
|---|--------|---------------|-----|
| 1 | Open access, publisher | Official published PDF at the DOI (gold/hybrid OA) | Unpaywall `oa_locations` with `host_type=publisher` and a `url_for_pdf` |
| 2 | Sci-Hub | Published version for paywalled articles | `citation_pdf_url` from `sci-hub.st/<DOI>` (mirrors below) |
| 3 | Open access, repository | Author's accepted/submitted manuscript | Unpaywall `best_oa_location.url_for_pdf` |
| 4 | arXiv | Genuine preprints, or last resort | `arxiv.org/pdf/<id>` |
| 5 | Manual | Author copy / institutional library | not automated — flag it |

Mirrors: `sci-hub.st`, `sci-hub.box`, `sci-hub.ru` work; `sci-hub.se` is unreliable. arXiv is **not**
a substitute for a published version — use it only for true preprints or when 1–3 fail.

## Quick start

```bash
# The skill:// path auto-resolves to the bundled script wherever this plugin is installed.
uv run --no-project python skill://retrieving-paper-pdfs/scripts/fetch_pdf.py <key> --doi <DOI> [--arxiv <id>] --out <store>/<key>.pdf
```

- `--out` sets the destination. Use the repo's PDF store if it has one (see the repo's `AGENTS.md` /
  bib rule — e.g. the thesis stores gitignored copies under `papers/<key>.pdf`); for a repo that
  does not store PDFs, point `--out` at a scratch path you read and discard.
- The script runs the full source order, validates the `%PDF` header on every candidate, and prints
  `OK <key>: <size> from <source> -> <out>` or a `FAIL` with the next step.
- It is stdlib-only Python 3 (no install). Set `UNPAYWALL_EMAIL` in your environment to your address
  (Unpaywall requires a contact email; a default is used otherwise).

## Workflow

```
- [ ] 1. Verify the DOI (OpenAlex) — a wrong DOI fetches the wrong paper
- [ ] 2. Run fetch_pdf.py with --doi (add --arxiv only for a genuine preprint) and --out
- [ ] 3. Confirm OK + the saved file starts with %PDF + nonzero size
- [ ] 4. On FAIL: find an OA author copy or use institutional access; save it manually, or flag
- [ ] 5. Read the paper before characterizing it
- [ ] 6. Register it: pull metadata from an authoritative source (never invent it) and format the
         entry per skill://formatting-bibtex-entries, into the repo's bib file (see the repo's AGENTS.md)
```

## Why a plain curl fails

`curl -o x.pdf https://sci-hub.st/<DOI>` saves the HTML viewer, not the PDF. You must extract
`citation_pdf_url` from that HTML and download it, then check the header. A file that starts with
`<!DOCTYPE` or `<html` is a saved web page — delete it and extract the real URL.

## Failure modes

| Symptom | Cause / fix |
|---------|-------------|
| Saved file is HTML, not a PDF | Downloaded the viewer page. Extract `citation_pdf_url`; validate `%PDF-`. |
| Sci-Hub returns only metadata (no `citation_pdf_url`) | Mirror lacks the file (common for post-~2023 IEEE/ACM/Springer). Try OA (Unpaywall) or an author copy. |
| Unpaywall says OA but download fails | The OA location is a landing page, not a direct PDF. Open it and find the PDF link, or use Sci-Hub. |
| Direct publisher fetch returns 403 | Publishers (ACM/IEEE) block scripted fetches. Use OA/Sci-Hub. The `read` tool can sometimes fetch bytes even when a plain fetch 403s. |
| `read` cannot text-extract a fetched PDF | The URL lacked a `.pdf` extension. Save the bytes locally as `.pdf` first, then read the local file. |
| All mirrors dead | Update `SCIHUB_MIRRORS` in the script (and any repo mirror note). |

## After acquiring

1. **Read it** before characterizing its mechanism/findings/limitations.
2. **Register it**: metadata from an authoritative source (OpenAlex / Crossref BibTeX / DBLP),
   verified against the paper; format per `skill://formatting-bibtex-entries`; add to the repo's bib
   file and store the PDF per the repo's policy.

## Scope

Repos that cite paywalled work may sanction Sci-Hub for the author's local reading copies (PDFs
gitignored). Prefer open access and author copies when available. This is the acquire step of the
`searching-literature` workflow.
