# Tasks

## 2. Search helper

- [x] 2.1 Implement index queries for OpenAlex, arXiv, Crossref and DBLP with spacing per index, retry after the indicated wait, a bounded number of attempts and the failed status. Verify with fixture tests that use an injected clock.
- [x] 2.2 Add paging to a requested count, the corpus with one record per identifier and the query log. Verify with fixture tests for a work from two indexes and for every log field.
- [x] 2.3 Share spacing through lock files in a state directory. Verify with a test that runs two processes against a local server and checks the recorded request times.
- [x] 2.4 Read the OpenAlex key from a file, send it as a header and add queries for citing and cited works. Verify with fixture tests that the log and the process arguments hold no key.
- [x] 2.5 Add the helper to the release asset list and the installed-release gate. Verify that the release-tree test fails when the helper is removed.
- [x] 2.6 Describe the helper's commands, results and exit statuses in the survey skill. Verify that each documented command runs against the fixtures on Windows from a path with spaces.

## 3. Skills

- [x] 3.1 Write `plugin/skills/literature-survey/SKILL.md` with scope, the three channels, harvest before screening, screening on title and abstract, the use of subagents and the report sections. Verify with the trials in group 4.
- [x] 3.2 Add the handover and the changed screening step to `plugin/skills/research-evidence/SKILL.md`. Verify with the single-citation trial and a coverage trial that starts in the evidence skill.
- [x] 3.3 Add the skill to the skill lists in `scripts/release.ts`, the plugin-load test and the installed-release gate, and name it in the README. Verify that `bun run check:local` passes and that a fresh session lists the skill.

## 4. Trials

- [x] 4.1 Collect the canary questions with their canary works outside this repository, and record their counts in evidence.md. Six questions were collected and five ran.
- [x] 4.2 Ask before starting the trials, because they spend model budget on about 20 agent runs. Run each question with the released plugin and with the candidate, confirm the outcomes from the trial files and record them in evidence.md.
- [x] 4.3 Fix what a trial shows and repeat that trial with a fresh agent. The fixes for the helper and for screening passed their repeats. The repeats of the first question did not pass, and the release was approved with that result recorded in evidence.md.

## 5. Local release preparation

- [x] 5.1 Raise the marketplace, plugin manifest and root package to the next matching minor version. Verify with the release-version check.
- [x] 5.2 Run strict validation for this change and `bun run check:local`. Verify that both pass.
- [x] 5.3 Stage only this change and create a local Conventional Commit with a causal body. Verify that the commit holds nothing else.

## Workflow follow-up

- The two reference-set reruns of the design did not run, because the approved trial budget was used up. The release was approved without them, and the history measurement four weeks after the release takes their place.
- The channel attribution and the search counts in evidence.md came from one-off analysis of a single day's survey files. They were not added to the measurement script of `improve-research-evidence-access`, which is kept for the repeated measurement.
- Archive the change with its accepted specs in the implementation pull request.
- Four weeks after the release, run the measurement script again and compare it with evidence.md.
