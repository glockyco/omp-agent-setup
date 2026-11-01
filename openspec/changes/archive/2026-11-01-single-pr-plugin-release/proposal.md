# Proposal

## Why

Routine host smoke and a later archive pull request duplicate isolated installed-release CI. A release needs one reviewable pull request containing its implementation, version signal and completed OpenSpec contract.

## What Changes

- Require each runtime release pull request to include matching manifest versions and its archived OpenSpec change.
- Retain immutable release tags, required CI and actual host UI acceptance for changed visual behavior.
- Use isolated installed-release CI for routine install, prompt-rule and upgrade acceptance instead of manual checks on both hosts.
- Leave hourly host upgrades to nix-config without making rollout a release prerequisite.
- Align contributor check guidance with documentation-only CI classification.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `plugin-update-automation`: single-pull-request releases, isolated routine acceptance and independent host rollout.

## Impact

AGENTS.md and the accepted release contract change. README already delegates release procedures to AGENTS.md. OpenSpec config has no release-specific templates. Runtime payload, generated adapters, workflow implementation and historical archived changes remain unchanged, so no runtime version bump is needed.
