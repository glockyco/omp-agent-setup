---
name: formatting-bibtex-entries
description: Use when adding or cleaning a BibTeX entry in any writing repo — normalizing a key, title, journal/conference name, DOI, or page range, or stripping DBLP cruft. The shared formatting conventions; the repo's bib rule says which .bib file and any section organization.
---

# Formatting BibTeX entries

Shared cleanup conventions for `.bib` entries. The repo's `AGENTS.md` / bib rule specifies the
target file (e.g. `main.bib`, `bibliography/references.bib`) and any section organization.

## Key format
`author_year_keyword` — first author's surname lowercase (e.g. `de_moura`), four-digit year, one
short lowercase title keyword, underscores. Examples: `baldoni_2018_survey`, `de_moura_2008_z3`,
`glock_2024_pasda`. **Never change an existing key** without updating every `\cite{...}` that uses it.

## Source preference
Take metadata from an authoritative source — **OpenAlex** or **Crossref BibTeX**
(`api.crossref.org/works/<DOI>/transform/application/x-bibtex`) first; DBLP is a fallback. Verify
against the paper; never fabricate.

## Cleanup rules
1. **Key:** replace any source-generated key (e.g. DBLP's `DBLP:journals/jss/GlockPP24`) with `author_year_keyword`.
2. **Title:** title-case; brace-protect tool names/acronyms/proper nouns (`{PASDA}`, `{Java}`, `{QuickCheck}`); a leading tool name gets `{PASDA:} {A} ...`.
3. **Journal names:** expand abbreviations — `J. Syst. Softw.` → `Journal of Systems and Software`; `IEEE Trans. Software Eng.` → `{IEEE} Transactions on Software Engineering`; `Commun. ACM` → `Communications of the {ACM}`; `ACM Comput. Surv.` → `{ACM} Computing Surveys`; `Empir. Softw. Eng.` → `Empirical Software Engineering`.
4. **Conference (booktitle):** full name — `Proceedings of the {n}th <Conference>` (ordinal known) or `Proceedings of the {year} <Conference>`; wrap acronyms `{IEEE}`/`{ACM}`/`{USENIX}`.
5. **Strip** `timestamp`, `biburl`, `bibsource`.
6. **URL vs DOI:** keep `doi`; drop `url` if it is just `https://doi.org/<doi>`; keep `url` only for resources with no DOI.
7. **DOI:** lowercase (`10.1016/j.jss.2024.112037`).
8. **Pages:** en-dash `123--134`.

## Example (before → after)
```bibtex
@article{DBLP:journals/jss/GlockPP24,
  title     = {{PASDA:} {A} partition-based semantic differencing approach ...},
  journal   = {J. Syst. Softw.},
  doi       = {10.1016/J.JSS.2024.112037},
  timestamp = {Sat, 08 Jun 2024 13:15:41 +0200},
  biburl    = {https://dblp.org/rec/journals/jss/GlockPP24.bib}
}
```
becomes
```bibtex
@article{glock_2024_pasda,
  title   = {{PASDA:} {A} Partition-Based Semantic Differencing Approach with Best-Effort Classification of Undecided Cases},
  journal = {Journal of Systems and Software},
  doi     = {10.1016/j.jss.2024.112037},
}
```
