# Tasks

## 1. Measurement

- [ ] 1.1 Save the history measurement as a script in this change and verify that it reproduces the counts in evidence.md for refused reads, helper outcomes, typed addresses and OpenAlex failures.

## 2. Acquisition helper

- [ ] 2.1 Report `MANUSCRIPT` with exit status 3 when a DOI of a published work yields only a repository or arXiv copy, and keep `OK` for posted content. Verify with fixture tests for both cases and for the saved file.
- [ ] 2.2 Name a failed open-access lookup in the final message and keep trying later sources. Verify with a fixture test in which the lookup raises and no later source succeeds.
- [ ] 2.3 Describe the three results and their exit statuses in the skill's acquisition step. Verify that the documented command produces each result against the fixtures.

## 3. Skill text

- [ ] 3.1 Run each candidate route against its refusing host, record refusal and success in evidence.md, and write the list with one route per host. Verify that every listed route has a recorded success.
- [ ] 3.2 Add the rule for HTML full text with location and version, and the published-version check before registration. Verify with the registration trial in group 4.
- [ ] 3.3 Add keyed OpenAlex access through `vault` with the bearer header built from the delivered file, and the keyless fallback. Verify with a live `/rate-limit` call that reports the key's own budget and with a keyed search that returns HTTP 200.
- [ ] 3.4 State that `UNPAYWALL_EMAIL` comes from the host environment only. Verify with the acquisition trial in group 4 on a host without the variable.

## 4. Trials

- [ ] 4.1 Run the four real trials from design.md with fresh subagents, once with the released skill and once with the candidate. Confirm each outcome from the transcript and record it in evidence.md.
- [ ] 4.2 Fix what a trial shows and repeat that trial with a fresh agent. Verify that the repeated trial passes.

## 5. Local release preparation

- [ ] 5.1 Raise the marketplace, plugin manifest and root package to the next matching patch version. Verify with the release-version check.
- [ ] 5.2 Run strict validation for this change and `bun run check:local`. Verify that both pass.
- [ ] 5.3 Stage only this change and create a local Conventional Commit with a causal body. Verify that the commit holds nothing else.

## Workflow follow-up

- The workstation repository sets `UNPAYWALL_EMAIL` on every host before this release is installed there.
- The person stores the OpenAlex key as an entry in the `private` Bitwarden vault.
- Archive the change with its accepted spec in the implementation pull request.
- Four weeks after the release, run the measurement script again and compare it with evidence.md.
