## Why

Work and personal notes now live in the Obsidian vault `notes`, which the owner and agents maintain together. Its conventions and its weekly review checklist are notes inside the vault, but no agent knows the vault exists or where those notes are. OMP loads context files only along the session's working directory, so an `AGENTS.md` in the vault would reach only sessions started there. The documentation rule also applies to every agent, and it would strip the dates, history and decision owners that meeting notes and decisions have to keep.

## What Changes

- Add a `notes` skill that sends agents to the vault's conventions note and states how to reach, change and commit the vault from any session.
- Add a `weekly-review` skill that prepares and runs the review that the vault's checklist note describes.
- Exempt notes in the vault from the documentation rule, because the vault's conventions govern them.
- Check both skills in the release-tree validation and the release gate.
- Release the change as a new minor version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Ship the two notes skills, and exempt vault notes from the documentation rule.

## Impact

Sessions on upgraded hosts discover the skills from any working directory. The skills point to the vault notes instead of restating them, so changing a convention needs no plugin release. Hosts keep the previous behavior until they upgrade.
