## Context

The commit-policy skill defines a causal body as one that names "the previous failure, invariant, constraint, or user-visible reason". An agent loads the skill only when the skill matches its task, while the `personal_commit` tool description is visible at every call. Neither currently says that a request is not a cause.

## Goals / Non-Goals

**Goals:**

- State the rule where an agent writes the message: in the skill and in the `body` field description.
- Show the difference with one weak and one strong example, in the style of the existing weak and causal bodies.

**Non-Goals:**

- Rewriting existing histories. That is a separate operation with its own push decision.
- Changing message formatting, validation, or Git execution.

## Decisions

**Guidance, not validation.** A rejecting pattern would need to match "the owner", "the user", "requested", and "feedback". These words also appear legitimately, for example in "user-visible behavior", "requested model candidates", or "ownership of the specification". A rejection would either miss paraphrases or block valid messages, and the tool would start judging content, which the Repository authority requirement leaves to hooks. The descriptions and the skill carry the rule instead. A repository that wants enforcement can add a commit-msg hook.

**State the rule in the skill and the `body` field.** The skill gives examples. The `body` field description, which agents see at every call, carries one short clause. The tool description stays unchanged to avoid repeating it.

## Risks / Trade-offs

- [An agent can still ignore the guidance] → The rule sits in the text the agent reads while filling the field, and repositories can add hooks for enforcement.
