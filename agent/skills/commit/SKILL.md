---
name: commit
description: Use when creating, amending, reviewing, or splitting git commits. Applies the user's global Conventional Commits policy.
---

# Commit Messages

## Required workflow

Use Conventional Commits:

```text
type[(scope)]: imperative summary
```

For any commit with a body, use the bundled helper. Pass the subject and body as
structured inputs; the helper wraps paragraphs, validates the final message with
commitlint, writes the internal `git commit -F` file, and runs git.

Agent path in OMP:

```bash
bun skill://commit/commit-helper.ts
```

with tool `env`:

```json
{
  "COMMIT_ACTION": "commit",
  "COMMIT_SUBJECT": "feat(area): add durable behavior",
  "COMMIT_BODY": "Explain why this change exists as normal prose. Separate paragraphs with a blank line."
}
```

Use `COMMIT_ACTION=amend` for amendments and `COMMIT_ACTION=dry-run` to inspect
the generated message without committing. Do not use repeated `git commit -m`
flags for body commits.

A title-only `git commit -m "type: summary"` is acceptable only for mechanical
changes whose purpose is fully explained by the subject.

## Message format

Subject:

- Use a commitlint-compatible type: `feat`, `fix`, `docs`, `style`, `refactor`,
  `perf`, `test`, `build`, `ci`, `chore`, or `revert`.
- Target 50 characters; hard limit 72.
- Use imperative mood: `add`, `fix`, `remove`; not `added` or `fixes`.
- Lowercase the summary after the colon unless it starts with a proper noun or
  code symbol.
- Do not end with a period.
- Use a scope only when it improves scanability.

Body:

- Write useful prose paragraphs, not disconnected sentence fragments.
- Explain why the change exists and the tradeoff or constraint it addresses.
- Do not paste command output, test summaries, or an implementation laundry list.
- The diff shows what changed; the body explains context future maintainers
  cannot infer from the diff.

## Atomicity

- Make one logical change per commit.
- Keep code, tests, and docs for one logical change in the same commit.
- Split unrelated cleanup from behavior changes.
- Each commit should compile and test independently where practical.
- Never push without an explicit user request.
