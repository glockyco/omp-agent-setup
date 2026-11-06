# Design

## Context

See [proposal.md](proposal.md) for the motivation. The extension tree registers two tools, `vault` and `personal_commit`. Vault operations already use private OMP dialogs, per-vault Bitwarden state, bounded master-password retries and value-free delivery files. Those boundaries stay unchanged.

## Goals / Non-Goals

The change makes tool selection and recovery possible from the listing and result alone. It does not add tools, actions, credential sources, automatic login retries or a permanent trial harness. It does not bypass approval, expose values, archive the change or publish a release.

## Decisions

1. Start the vault description with the approved sign-in use cases and account mapping. Keep delivery, redaction, lifetime and browser/CLI consumption instructions after that opening.
2. Route nonzero Bitwarden results through a small shared error formatter. Recognize network, credential, two-step, missing-entry and locked-session failures before adding the operation-specific next step. Preserve a redacted first diagnostic line when it helps diagnosis.
3. Recognize the CLI's master-key decryption failure in the existing three-attempt unlock loop. Exhaustion explains that a new call prompts again. Other failures do not acquire new retry behavior.
4. Distinguish `Deny`, which is persisted, from a dismissed approval dialog. A denial tells the agent not to bypass it. An accidental dismissal can be requested again.
5. A consumed delivery file is not read by the vault tool, so a missing path cannot produce a vault error. Put replacement instructions in both the description and delivery result instead of inventing an expiry action. TOTP freshness is independent of file lifetime.
6. Keep `personal_commit` wording unless a real session or a fresh task-based trial shows misuse. Preserve its required causal-body description and hook authority.
7. Record the audit, session cases, before-and-after messages and one-off reading trials in [evidence.md](evidence.md). Reading trials show tool-selection plans, not successful sign-ins or real user behavior. Follow [Anthropic's tool-writing guidance](https://www.anthropic.com/engineering/writing-tools-for-agents) for task-first context, unambiguous inputs, actionable errors and concise results.

## Risks / Trade-offs

- Bitwarden versions can phrase the same rejection differently. Match known diagnostic families and retain a safe operation-specific fallback rather than claiming every unknown error is a mistype.
- A master-key decryption error can have a cause other than a mistyped password. Describe the failed decryption and allow private re-entry without asserting corruption or guaranteed success.
- A network hint does not mean a credential exists in the other vault. Limit the private-vault suggestion to personal and university accounts.
- Session forks can hide pre-compaction turns. Extract tool errors mechanically from raw JSONL, then use historical consultations for conclusions and report any unavailable context.
