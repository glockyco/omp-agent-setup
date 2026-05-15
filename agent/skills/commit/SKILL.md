---
name: commit
description: Use when creating, amending, reviewing, or splitting git commits. Applies the user's global Conventional Commits policy.
---

# Commit Messages

## Policy

Use Conventional Commits:

```text
type[(scope)]: imperative summary
```

Use commitlint-compatible types:

- `feat`: user-visible feature
- `fix`: bug fix
- `docs`: documentation-only change
- `style`: formatting-only change with no behavior impact
- `refactor`: code change that is neither a feature nor a fix
- `perf`: performance improvement
- `test`: test-only change
- `build`: build system or dependency change
- `ci`: continuous integration change
- `chore`: maintenance change that fits no narrower type
- `revert`: revert a previous commit

## Subject

- Target 50 characters; hard limit 72.
- Use imperative mood: `add`, `fix`, `remove`; not `added` or `fixes`.
- Lowercase the summary after the colon unless it starts with a proper noun or code symbol.
- Do not end with a period.
- Scope is optional. Use a short, clear area only when it improves scanability.
- Never invent or enforce project-specific scope vocabularies.

## Body

- Leave one blank line after the subject.
- Wrap prose at 72 columns.
- Explain why the change exists and the tradeoff or constraint it addresses.
- Prefer prose paragraphs; use bullets only when they are genuinely clearer.
- Do not paste command output or test summaries into the commit message.
- The diff shows what changed. The body explains what future maintainers cannot infer from the diff.

## Atomicity

- Make one logical change per commit.
- Keep code, tests, and docs for one logical change in the same commit.
- Split unrelated cleanup from behavior changes.
- Each commit should compile and test independently where practical.

## Validation and enforcement

- If commitlint is configured, treat it as the source of truth for syntax enforcement.
- Per-repo validation commands live in that repo's `AGENTS.md` or `README`, not in this global skill.
- Never push without an explicit user request.
