## 1. Rule

- [x] 1.1 Rewrite `plugin/rules/project-handoff.md` to link sessions through the `workbench` tool with the vault search as fallback, and verify with `bun run check:local`.
- [x] 1.2 Raise the release version to 0.7.5 in `.omp-plugin/marketplace.json`, `plugin/package.json` and the root `package.json`, and verify the release-version check passes.

## 2. Release

- [ ] 2.1 Merge after the Linux, macOS, Windows and OpenSpec CI contexts pass, tag `v0.7.5`, and verify in a disposable OMP profile that the installed rule text is the new one.
- [ ] 2.2 Upgrade Korolev and the Mac and verify in a fresh session that the system prompt carries the new rule.
