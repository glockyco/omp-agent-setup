## 1. Repository resolution

- [x] 1.1 Accept an optional `repo` field in `parseCommitInput`, rejecting a non-string value
- [x] 1.2 Resolve the target: absolute `repo` as given, relative `repo` against the session working
      directory, and the session working directory when absent
- [x] 1.3 Reject a target that does not exist or is not a directory, naming the path
- [x] 1.4 Reject a target outside any Git work tree, naming the path, before writing a message file
- [x] 1.5 Resolve the reported root with `git rev-parse --show-toplevel` so a subdirectory reports its
      work tree root

## 2. Reported target

- [x] 2.1 Return the resolved repository root from `executeCommit` for every action
- [x] 2.2 Include the repository root in the tool's text output and in its details
- [x] 2.3 Add `repo` to the registered tool parameters and to the tool description

## 3. Tests

- [x] 3.1 Commit into a sibling disposable repository via `repo` and assert the session repository is
      unchanged
- [x] 3.2 Assert a relative `repo` resolves against the session working directory
- [x] 3.3 Assert a non-existent path, a file, and a directory outside any work tree are each rejected
      with the path named, and that no commit is created
- [x] 3.4 Assert preview reports the resolved root without mutating the repository
- [x] 3.5 Assert a subdirectory target reports the work tree root

## 4. Documentation and gates

- [x] 4.1 Document `repo` in `plugin/skills/commit-policy/SKILL.md`. Leave
      `plugin/rules/personal-policy.md` unchanged: it lists policy, and transport parameters there
      would add noise to every session
- [x] 4.2 Run `nix develop --command bun run ci`
- [x] 4.3 Run `nix flake check`
- [x] 4.4 Commit code, tests, and the spec change together
