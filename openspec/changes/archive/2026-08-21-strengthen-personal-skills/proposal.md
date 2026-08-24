## Why

The personal skills contain useful guidance, but their global routing and task boundaries do not match the intended workstation behavior. Agents must apply STE to durable technical prose, create regular atomic commits, and keep everyday research efficient for computer-science work.

## What Changes

- Route technical-prose work through the Simplified Technical English skill and remove the existing ordinary-output labeling instruction.
- Cover plans, specifications, commit text, code comments, docstrings, CLI text, errors, and agent instructions as technical prose.
- Make atomic commits the normal checkpoint after each coherent, verified unit of work, even without an explicit commit request.
- Permit agents to stage task-owned changes, preserve useful revision commits, and prohibit pushing without an explicit user request.
- Keep research focused on computer science and adjacent technical literature.
- Let metadata-only citation work skip unnecessary search, acquisition, and full-text reading.
- Make repository bibliography conventions authoritative over skill defaults.
- Define a concise evidence characterization that records the supported claim, source location, relevant method or data, result, and limitations without forcing irrelevant fields.
- Preserve the acquisition order of official publisher open access, Sci-Hub, green open access, arXiv, and manual access. Use metadata to make the publisher open-access check inexpensive.
- Keep all generated OpenSpec skills and commands byte-exact with the pinned generator.
- Do not add model-backed skill-activation evaluations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Route technical prose to the STE skill and require regular atomic commit checkpoints in the short always-applied policy.
- `simplified-technical-english`: Expand pragmatic software-writing coverage and remove the ordinary-output labeling requirement.
- `research-evidence`: Add an efficient metadata-only path, repository-convention precedence, concise evidence characterization, and an explicit computer-science focus while preserving acquisition precedence.
- `structured-commit`: Make autonomous atomic commits, task-owned staging, checkpoint frequency, revision preservation, and explicit push authorization part of the commit contract.

## Impact

- Affects the three authored personal skills, the always-applied personal policy, their accepted specifications, and deterministic tests.
- May require commit guidance and examples in `plugin/skills/commit-policy/SKILL.md`.
- May require software-writing and research reference updates under the authored skill directories.
- Does not modify generated `plugin/skills/openspec-*` skills or `plugin/commands/opsx-*` commands.
- Adds no runtime dependency and does not change OMP-owned mutable state.
