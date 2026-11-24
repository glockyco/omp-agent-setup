# Proposal

## Why

The search helper paced requests per survey directory. Surveys in different directories, such as parallel benchmark runs or two sessions on one machine, each kept their own spacing, so together they sent several requests at once. arXiv allows one request every three seconds over a single connection for all machines of a user, Semantic Scholar one request per second per key, and OpenAlex one semantic search per second per key. After a day of parallel runs, arXiv answered every request from the address with HTTP 429.

## What Changes

- Pacing state lives in one directory per user, `~/.cache/research-evidence/pace` unless `RESEARCH_EVIDENCE_PACE_DIR` names another, so every search of the user shares the spacing.
- Requests to arXiv, Semantic Scholar and OpenAlex semantic search hold a lock until their answer arrives, so at most one is open per index.
- The survey directory keeps the query log and the corpus with their own locks.

## Capabilities

### Modified Capabilities

- `literature-survey`: pacing is shared per user and one connection per index is enforced where providers require it.

## Impact

- `plugin/skills/research-evidence/scripts/search_index.py` and `tests/test_search_index.py`.
- The plugin, marketplace and root package versions advance by a patch version.
