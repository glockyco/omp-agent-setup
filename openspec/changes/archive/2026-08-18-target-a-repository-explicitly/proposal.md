## Why

`personal_commit` commits in `ctx.cwd` and nowhere else, and it never says which repository that was.
Both halves of that caused a real failure.

A task spanning two repositories staged a commit in a sibling repository, called the tool, and Git
committed nothing there. The tool reported the *session* repository's unstaged files instead, so the
output described a working tree the caller had not touched. The caller had to read the error closely to
notice that the commit had been attempted against the wrong repository. Nothing in the tool's contract,
input, or output names a repository, so there was no way to state the intent and no way to see the
mistake.

The gap is not only ergonomic. A tool that mutates a repository must say which repository it mutated.

## What Changes

- Add an optional `repo` parameter naming the repository to commit in. A relative value resolves
  against the session working directory, so the common case stays short.
- Reject a `repo` that does not exist, is not a directory, or is not inside a Git work tree, before
  writing a message file or invoking Git.
- Report the targeted repository in the result of every action, so a commit cannot land unnoticed. For
  commit and amend that is the verified work tree root. Preview stays inert, as its accepted contract
  requires, so it reports the path it would use without reading a filesystem or invoking Git.
- Keep the default behavior: without `repo`, the tool commits in the session working directory exactly
  as before.

## Capabilities

### Modified Capabilities

- `structured-commit`: Git execution gains an explicit repository target, and every action reports the
  repository it resolved.

## Impact

- `plugin/extensions/personal-commit.ts`: input parsing, repository resolution, `executeCommit`, and
  the registered tool's parameters and result.
- `plugin/tests/personal-commit.test.ts`: cases for targeting a sibling repository, rejecting a
  non-repository path, and reporting the resolved root.
- `plugin/skills/commit-policy/SKILL.md`: the documented transport gains the parameter.
  `plugin/rules/personal-policy.md` stays unchanged, because it lists policy rather than transport.
- No change to staging, pushing, hook handling, or message formatting.
