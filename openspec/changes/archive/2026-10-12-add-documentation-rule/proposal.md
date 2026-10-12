## Why

Agents turn guides into logs. nix-config's Windows runbook grew to 444 lines of dated evidence, owner statements, finished migration steps and a tool table that restated the declaration it described. Its AGENTS.md already said to keep evidence out of current-state manuals, but the subagents that wrote the runbook never saw it: OMP does not pass a repository's AGENTS.md to task subagents. Planning tasks such as "update the runbook's sections for X" invited the dump.

## What Changes

- Add an always-applied rule, `plugin/rules/documentation.md`. Documentation describes the current state. Facts stay in their source, evidence and history go to the change record, rationale goes into one sentence, a code comment or the change's design, and finished one-time procedures are deleted. Plans that change documentation name what the reader needs, not content to copy.
- Check the rule in the release-tree validation and the release gate, with a negative control.
- State the capability-isolation scenario in terms of every shipped always-applied rule, so a new rule does not modify it.
- Release the change as a new minor version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Ship the documentation rule, and discover every always-applied rule without naming each one in the isolation scenario.

## Impact

Every session and subagent on an upgraded host carries the rule in its system prompt. Hosts keep the previous behavior until they upgrade.
