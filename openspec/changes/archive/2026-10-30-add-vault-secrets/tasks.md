# Tasks

## 1. Extension

- [x] 1.1 Implement `plugin/extensions/vault.ts` with the `vault` tool (`search`, `file`, `lock`), injected process, keystore, clock and UI boundaries, and declare it in `plugin/package.json`.
- [x] 1.2 Implement login, two-step login, the API-key fallback, unlock, the midnight cache and expiry cleanup.
- [x] 1.3 Implement approvals and the redaction hooks (`tool_result`, `context`, `before_provider_request`, `tool_call` guard) with the process-wide value set and its reload at session start.
- [x] 1.4 Unit tests with a stub `bw` for every scenario in `specs/vault-access/spec.md`, and integration tests for the real keystore round trip on Windows and macOS.

## 2. Repository

- [x] 2.1 Update README and AGENTS.md: the vault capability, the optional `bw` prerequisite and the scoped `~/.omp/vault/` state. Update the plugin contract and release-gate expectations for the third extension.
- [x] 2.2 Bump the release version and run `bun run ci`.

## 3. Acceptance

- [x] 3.1 Release the plugin and upgrade it on Korolev and the Mac.
- [x] 3.2 With throwaway canary entries in both vaults, run login, delivery in all formats, a command that echoes the value, a browser fill from a file and a restart in a real Tern session. Check that the model saw only labels and that the saved session holds no canary value.

## Evidence (2026-10-30, Korolev)

- `bun run ci` passed on Ubuntu, macOS and Windows for PR #96 (v0.9.0) and PR #97 (v0.9.1). Both hosts run 0.9.1 through the plugin manager.
- The first real login to the private Bitwarden account, which uses a YubiKey, failed twice with v0.9.0's method menu. v0.9.1 replaced the menu with one code prompt, and the YubiKey login then succeeded. The SCCH login succeeded with v0.9.0.
- Throwaway "omp canary" entries with random values were created in both vaults by script, never printed. In a fresh Tern session, the agent searched both vaults, received raw, dotenv and header files, printed all three files with `cat`, and read a browser password field back after filling it from a file. Every output showed only `[vault:...]` labels.
- A new OMP process printed an earlier delivery file and received a new delivery from the always-approved entry without any prompt. Both outputs showed only labels.
- A byte scan of `~/.omp/agent` (session files and databases) and `%LOCALAPPDATA%\Tern` for each canary value, in UTF-8, UTF-16 and JSON-escaped form, found no match before delivery, after delivery or after the restart. The canary entries and their delivery files were then deleted.
