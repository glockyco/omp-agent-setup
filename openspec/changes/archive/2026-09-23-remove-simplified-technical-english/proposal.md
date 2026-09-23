## Why

The always-applied policy routes nearly every writing task through Simplified Technical English. That overhead is unwanted, and its controlled technical style is a poor fit for scientific writing.

## What Changes

- **BREAKING** Remove the packaged `simplified-technical-english` skill and its unconditional policy routing. Writing style remains determined by the user's request and the document's conventions.
- Retire the STE-specific traceability check and update payload assertions, repository guidance, and current-state documentation. Preserve archived planning records as historical artifacts.
- Remove the accepted STE capability contract and update the personal plugin contract to describe the remaining policy and skills.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Remove automatic STE routing from the always-applied policy and exclude the STE skill from the immutable payload.
- `simplified-technical-english`: Remove the capability and its requirements because the skill is no longer shipped.

## Impact

The source of change is `plugin/skills/simplified-technical-english/` and `plugin/rules/personal-policy.md` in this repository. Packaging and assertions in `plugin/tests/`, `README.md`, and `AGENTS.md` must match. The `nix-darwin` workstation consumes a pinned revision; that pin and activation require a separate, reviewed release step. Existing sessions and immutable generations continue to use their previously selected plugin until replaced.
