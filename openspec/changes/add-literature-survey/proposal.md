# Proposal

## Why

A question about what exists on a topic gets the same light workflow as a single citation. The person corrected the reach of a search 27 times in three months, twice in November with the demand to query an index instead of the web alone. On 2026-11-23 a session built its own paced search tool, corpus and report structure to answer such questions properly, and its reports show that web search and index queries find mostly different works. None of that is in the plugin, and the skill still prescribes screening by title. The measurements are in [evidence.md](evidence.md).

## What Changes

- A new skill, `literature-survey`, covers coverage questions: state of the art, prior art, novelty and how much has been published. `research-evidence` hands such questions over and keeps the work on individual papers.
- A bundled helper, `search_index.py`, runs index queries with pacing per index, retries, paging and a query log, follows citation links, and writes a corpus with abstracts.
- A survey searches an enumerable index, the web and the citation links of the closest works, and says which of them ran.
- Screening decisions rest on title and abstract, in both skills.
- A survey report states how the search was done, what these queries did not find, and how much of each cited work was read and by whom.

## Capabilities

### New Capabilities

- `literature-survey`: coverage questions about the literature, answered with searches whose reach is recorded.

### Modified Capabilities

- `research-evidence`: hands coverage questions to the survey skill and screens on title and abstract.

## Impact

- New `plugin/skills/literature-survey/` with `SKILL.md` and `scripts/search_index.py`, and a new `tests/test_search_index.py`.
- `plugin/skills/research-evidence/SKILL.md` gains the handover and the changed screening step.
- The skill and asset lists in `scripts/release.ts`, the plugin-load test and the installed-release gate gain the new skill and its helper. The README names the skill.
- The plugin, marketplace and root package versions advance together by a minor version.
- Keyed OpenAlex queries rely on the vault entry and the key handling of `improve-research-evidence-access`, which lands first.
- The trials in the design spend model budget.
