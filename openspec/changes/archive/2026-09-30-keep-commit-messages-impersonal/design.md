## Context

The commit-policy skill asks for a causal body but does not say that a request is not a cause. Agents load the skill only when it matches the task. The `personal_commit` parameters are visible at every call.

## Goals / Non-Goals

**Goals:**

- Put the rule in the skill and in the `body` field description.
- Add one weak and one better example beside the existing ones.

**Non-Goals:**

- Rewriting existing history. That needs its own push decision.
- Changing message formatting, validation, or Git execution.

## Decisions

**Guidance, not validation.** Attribution words also occur in valid bodies: "user-visible behavior", "requested model candidates", "ownership of the specification". A pattern would miss paraphrases or block valid messages. Judging content also belongs to repository hooks, per the Repository authority requirement. Repositories that want enforcement can add a commit-msg hook.

**Skill and `body` field, not the tool description.** The skill holds the examples. The `body` field carries one short clause, which agents read while writing the body. Repeating it in the tool description adds nothing.

## Risks / Trade-offs

- [Agents can still ignore the guidance] → The rule sits where the body is written. Repositories can enforce it with hooks.
