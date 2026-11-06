# Proposal

## Why

A sign-in page blocked an agent even though the vault tool could supply the credentials. Vault errors also leave agents without a recovery step, including cases where a person mistyped private input.

## What Changes

- Put the vault's sign-in use cases, account ownership and network requirements before its file-delivery mechanics.
- Make vault failures identify what happened and the safe next action without revealing credentials or treating a mistyped input as a permanent blocker.
- Audit both registered extension tools against Anthropic's tool-writing guidance and run one-off, task-based reading trials. Change other wording only where a session or trial shows misuse.
- Add behavior coverage for changed error paths and raise the plugin to the next patch version.
- Keep session evidence, before-and-after messages, audit findings and trial results in this change. Do not add a permanent evaluation harness.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-access`: task-first discovery and actionable, value-free recovery messages.

## Impact

The runtime changes are confined to `plugin/extensions/` and associated unit tests. The plugin, marketplace and root package versions advance together. Existing private dialogs, approval decisions, secret delivery, redaction and commit transport remain authoritative. The active change will remain unarchived for release review.
