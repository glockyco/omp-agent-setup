# Tasks

## 1. Evidence and audit

- [x] 1.1 Search both hosts' session JSONL for actual vault errors, consult historical sessions for conclusions, and record session ids, dates, recovery and the matching new guidance in evidence.md.
- [x] 1.2 Audit every tool registered in plugin/extensions against task-first context, parameter clarity, actionable errors and response signal. Give fresh task agents only the visible tool list and one or two realistic tasks per tool. Record their exact calls and outcomes in evidence.md. Change other wording only for an observed failure.

## 2. Vault behavior

- [x] 2.1 Replace the vault description opening with the approved sign-in wording and tighten the existing mechanics. Add replacement-file and fresh-TOTP guidance where the agent consumes a delivery.
- [x] 2.2 Make all vault error paths name the condition and a safe next action, including network access, incorrect private input, two-step rejection, approval denial or dismissal, missing entries/fields, unavailable UI, host prerequisites and malformed input. Retain existing security boundaries and bounded retry behavior. Record every before-and-after error message in evidence.md.
- [x] 2.3 Extend the existing unit scenarios for changed error families and demonstrate that a master-key decryption failure can recover through private re-entry, a later call prompts after exhausted attempts, and a wrong two-step code does not trigger API-key fallback.

## 3. Local release preparation

- [x] 3.1 Raise the marketplace, plugin manifest and root package to the next matching patch version. Keep documentation changes in the active change and leave generated adapters untouched.
- [x] 3.2 Run strict validation for this change, bun run check:local and the unit tests. Record exercised checks and any remaining release gates in evidence.md.
- [x] 3.3 Inspect and stage only this change, then create a local Conventional Commit with a causal body through personal_commit. Do not archive, push, tag or release.
