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

For any commit that needs a body, write the complete message to a temp file and
commit with `git commit -F <file>`. Do not assemble bodies with repeated `-m`
flags; each `-m` is a separate paragraph, which produces fragmented messages and
makes line wrapping unreliable.

Use a title-only commit only when the subject fully explains a mechanical change.
If a future maintainer needs to know why the change exists or what tradeoff it
makes, write a body.

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

- Leave one blank line after the subject.
- Write useful prose paragraphs, not disconnected sentence fragments.
- Explain why the change exists and the tradeoff or constraint it addresses.
- Wrap every body line at 72 characters or less.
- Do not paste command output, test summaries, or an implementation laundry list.
- The diff shows what changed; the body explains context future maintainers
  cannot infer from the diff.

## Commands

Preferred body workflow:

```bash
# Create /tmp/commit-message.txt with the editor or file-write tool, then:
git commit -F /tmp/commit-message.txt
```

Amend with the same workflow:

```bash
git commit --amend -F /tmp/commit-message.txt
```

A single `-m` is acceptable only for title-only mechanical commits:

```bash
git commit -m "style: format generated files"
```

If commitlint rejects a message, edit the temp file and rerun `git commit -F` or
`git commit --amend -F`. Do not switch back to repeated `-m` fragments.

## Atomicity

- Make one logical change per commit.
- Keep code, tests, and docs for one logical change in the same commit.
- Split unrelated cleanup from behavior changes.
- Each commit should compile and test independently where practical.
- Never push without an explicit user request.
