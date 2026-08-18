---
name: commit-policy
description: Plan, create, amend, or review Git commits with the personal Conventional Commits policy and causal bodies. Use the personal_commit tool for transport.
---

# Commit policy

Use this subject form:

```text
type[(scope)]!: imperative summary
```

The repository's hooks and CI own its permitted types, scopes, generated-file rules, and release policy. Do not duplicate those enums here.

Every commit needs a body. The body explains **why** the change exists. Include facts such as the previous failure, invariant, constraint, or user-visible reason. Do not list only edited files or restate the subject.

Use `personal_commit` for preview, commit, and amend. Pass the subject and body as separate structured fields. Do not put escaped `\\n` sequences in either field.

Pass `repo` to commit in a repository other than the session's. A relative value resolves against the session directory. Every result names the repository it targeted, so check that line when a task spans more than one repository.

The tool:

- checks the cross-repository Conventional Commit shape;
- verifies the target repository before it writes anything, and reports the work tree root it committed in;
- requires a body;
- preserves paragraph boundaries and wraps prose;
- writes one internal message file;
- invokes ordinary Git commit or amend with `-F`;
- leaves repository hooks enabled.

It never stages, pushes, bypasses hooks, or runs planning commands. Inspect the working tree and index before you call it. Split unrelated changes before commit.
