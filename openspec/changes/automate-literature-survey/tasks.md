# Tasks

## 1. Search helper

- [x] 1.1 Move `search_index.py` and its tests to the research-evidence skill. Verify that the fixture tests pass from the new path.
- [x] 1.2 Add OpenAlex semantic search and related works to the helper. Verify with fixture tests for the request and the parsed records.

## 2. Survey program

- [x] 2.1 Write `survey.py` with planning, harvest, screening, expansion rounds, coverage numbers, web finds and the benchmark, with the model calls injected. Verify with fixture tests for saturation, the budget stop, complete screening, the estimate and the known-work probe.
- [x] 2.2 Run the program live on one canary question in eval. Verify that coverage.md is written and counts the records left unscreened.

## 3. Skills and release lists

- [x] 3.1 Add the survey section to `research-evidence` and remove the `literature-survey` skill. Verify that no file outside the archive names the removed skill.
- [x] 3.2 Update the skill and asset lists in `scripts/release.ts`, the plugin-load test, the installed-release gate and the README. Verify that `bun run check:local` passes.

## 4. Benchmark and trial

- [x] 4.1 Write the private canary file next to survey-canaries.md and run the benchmark. Verify that it reports at least the 9 of 11 canaries that reached the candidates in the measurement, and record the stages in evidence.md.
- [ ] 4.2 Run one fresh-session trial with a coverage question on the installed candidate. Verify that the agent runs the program and quotes coverage.md.

## 5. Release preparation

- [x] 5.1 Raise the marketplace, plugin manifest and root package to the next minor version. Verify with the release-version check.
- [x] 5.2 Run strict validation and `bun run check:local`. Verify that both pass.
