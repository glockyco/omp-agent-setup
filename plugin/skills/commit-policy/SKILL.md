---
name: commit-policy
description: Plan, stage, write, preview, create, amend, or review atomic Git commits under the personal Conventional Commits policy. Use after a coherent, verified unit of work, even without an explicit commit request. Preserve useful revision history, use personal_commit for commit and amend transport, and never push without an explicit request.
---

# Commit policy

## Create verified checkpoints

During multi-step work, create an atomic commit after each coherent, verified unit. Do not wait for the complete change when an earlier unit is independently useful and its applicable checks pass.

Before each commit:

1. Inspect the working tree.
2. Stage only changes owned by the current task.
3. Inspect the staged diff.
4. Confirm that the staged change has one subject and that applicable checks pass.
5. Call `personal_commit`.

Never stage unrelated or user-owned changes. If a file contains inseparable changes with different owners, delay the commit until you can separate them safely.

## Preserve useful history

Create a new commit when later work makes a distinct correction or improvement to a valid checkpoint. This preserves the development sequence and gives the user a rollback point.

Amend only when the user requests it or when the immediate commit does not yet represent the intended atomic action. Do not amend a valid checkpoint only to make the final history appear perfect.

Never push commits or tags without an explicit user request.

## Write the message

Use this subject form:

```text
type[(scope)]!: imperative summary
```

The repository's hooks and CI own its permitted types, scopes, generated-file rules, and release policy. Do not duplicate those enums here.

Every commit needs a body. The body explains **why** the change exists. Include the previous failure, invariant, constraint, or user-visible reason. Do not list only edited files or restate the subject.

Weak body:

```text
Update the configuration and tests.
```

Causal body:

```text
The wrapper loaded writable plugin paths, so a generation could not reproduce
the same agent behavior. Pin the plugin output so rollback restores the same
capabilities.
```

## Use structured transport

Use `personal_commit` for preview, commit, and amend. Pass the subject and body as separate structured fields. Do not put escaped `\\n` sequences in either field.

Pass `repo` when the target is not the session repository. A relative path resolves against the session directory. Check the repository path in every tool result.

`personal_commit` verifies the repository, formats the causal message, invokes ordinary Git commit or amend with hooks enabled, and reports the work tree root. It never stages, pushes, bypasses hooks, or runs planning commands. Use ordinary Git staging before you call it.
