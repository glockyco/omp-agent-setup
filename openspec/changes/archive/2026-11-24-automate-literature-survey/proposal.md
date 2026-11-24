# Proposal

## Why

The survey skill of 0.12.0 keeps its procedure in prose, and agents follow it only in part. In the trials they skipped channels and citation links, stopped after a few minutes and screened part of what they collected. A measurement on the trial data shows that most relevant works were lost after retrieval, and that keyword search finds far less than semantic search with citation expansion. The numbers and the comparison with other systems are in [evidence.md](evidence.md).

## What Changes

- A survey program runs the procedure: OpenAlex semantic and keyword search, the newest arXiv works, citation expansion of kept works in rounds until a round adds almost nothing, and a model screening every record against criteria derived from the question.
- The program writes the coverage numbers: what each channel found, the overlap of independent channels with an estimate of the total, the works each round added, and whether known works turned up. The report's account of the search comes from these numbers.
- Works an agent finds on the web enter the same corpus and screening through the program.
- `research-evidence` gets a short section that runs the program for coverage questions. The `literature-survey` skill is removed, and `search_index.py` moves to `research-evidence`.
- A private canary benchmark runs the program on questions whose earlier answers were overturned and reports recall per stage.

## Capabilities

### Modified Capabilities

- `literature-survey`: the procedure runs as a program with complete screening, saturation rounds and coverage numbers.
- `research-evidence`: runs the survey program for coverage questions instead of handing over to another skill.

## Impact

- `plugin/skills/research-evidence/scripts/` gains `survey.py` and receives `search_index.py`. `plugin/skills/literature-survey/` is removed.
- `tests/test_search_index.py` follows the move, and `tests/test_survey.py` is new.
- The skill and asset lists in `scripts/release.ts`, the plugin-load test and the installed-release gate change accordingly. The README follows.
- The plugin, marketplace and root package versions advance by a minor version.
