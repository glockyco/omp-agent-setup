## Why

After feedback in a conversation, agents write commit bodies such as "The owner found the paragraph incoherent" or "as requested". These record who asked for a change, not why it exists, so the history loses the reason. The commit policy asks for a causal body but never says that a request is not a cause. Fixing such messages later means rewriting published history.

## What Changes

- The commit policy says a body gives the reason for a change, not who asked for it, with a weak and a better example.
- The `personal_commit` `body` field description repeats the rule, so agents see it even without the skill loaded.
- No validation rejects such wording (see design.md).

## Capabilities

### New Capabilities

### Modified Capabilities

- `structured-commit`: commit bodies give the reason, not the requester.

## Impact

- `plugin/skills/commit-policy/SKILL.md`: new subsection under "Write the message".
- `plugin/extensions/personal-commit.ts`: `body` field description only. Formatting, validation, and Git execution are unchanged.
- nix-config picks up the change when it updates its `personal-omp-plugin` lock.
