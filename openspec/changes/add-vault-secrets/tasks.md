# Tasks

## 1. Extension

- [x] 1.1 Implement `plugin/extensions/vault.ts` with the `vault` tool (`search`, `file`, `lock`), injected process, keystore, clock and UI boundaries, and declare it in `plugin/package.json`.
- [x] 1.2 Implement login, two-step login, the API-key fallback, unlock, the midnight cache and expiry cleanup.
- [x] 1.3 Implement approvals and the redaction hooks (`tool_result`, `context`, `before_provider_request`, `tool_call` guard) with the process-wide value set and its reload at session start.
- [x] 1.4 Unit tests with a stub `bw` for every scenario in `specs/vault-access/spec.md`, and integration tests for the real keystore round trip on Windows and macOS.

## 2. Repository

- [x] 2.1 Update README and AGENTS.md: the vault capability, the optional `bw` prerequisite and the scoped `~/.omp/vault/` state. Update the plugin contract and release-gate expectations for the third extension.
- [ ] 2.2 Bump the release version and run `bun run ci`.

## 3. Acceptance

- [ ] 3.1 Release the plugin and upgrade it on Korolev and the Mac.
- [ ] 3.2 With throwaway canary entries in both vaults, run login, delivery in all formats, a command that echoes the value, a browser fill from a file and a restart in a real Tern session. Check that the model saw only labels and that the saved session holds no canary value.
