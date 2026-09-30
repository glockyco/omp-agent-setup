## Why

Agents that revise work in response to conversational feedback write commit bodies such as "The owner found the paragraph incoherent" or "as requested". This names a person or a conversation as the cause. The commit then records who asked for the change instead of why it was needed, and readers of the history cannot see the defect. The commit policy asks for a causal body but does not say what counts as a cause, so a request passes as one. Cleaning up affected histories requires rewriting published commits.

## What Changes

- The commit policy requires self-contained bodies. A body states the defect, constraint, or behavior in terms of the repository's content. It does not attribute the change to the user, an owner, a reviewer, feedback, or the conversation.
- The commit-policy skill gains a weak and a strong example of an attributed body.
- The `personal_commit` `body` field description states the rule, so an agent sees it at every call, even without the skill loaded.
- No validation rejects such wording. The guidance stays in prompts (see design.md).

## Capabilities

### New Capabilities

### Modified Capabilities

- `structured-commit`: adds a requirement that commit bodies are self-contained and that the tool's agent-visible descriptions state it.

## Impact

- `plugin/skills/commit-policy/SKILL.md`: new subsection under "Write the message".
- `plugin/extensions/personal-commit.ts`: `body` field description. Formatting, validation, and Git execution are unchanged.
- Consumers pick up the change when nix-config updates its `personal-omp-plugin` lock.
