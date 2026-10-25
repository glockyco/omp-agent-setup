## Why

Coding sessions do not load the notes skill, so its instruction to update a project's handoff never reaches them. The vault's `Resume here:` lines remain placeholders instead of telling the next session where to continue.

## What Changes

- Move the handoff duty from the notes skill into an always-applied project handoff rule.
- Match repository work to a project, paper or supervision note through the repository URL in its `links`.
- Read the handoff before work and update it and dated tasks before finishing, using the notes skill for vault changes and commits. Skip both when no note exists.
- Extend release-tree and installed-session checks to require the rule.
- Release personal 0.7.0 and verify the rule in fresh sessions on both hosts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Always load the project handoff duty, independently of notes skill selection.

## Impact

Repository sessions on upgraded hosts discover and maintain the same handoff notes as sessions working directly in the vault. The notes skill remains the source for vault conventions, access and commits. No other repository or vault content changes in this release.
