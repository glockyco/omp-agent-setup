# Proposal

## Why

The owner-approved fleet migration replaces the Nix-wrapped OMP deployment with upstream OMP and its native plugin manager on macOS, Linux/WSL, and Windows. This repository must publish a versioned, self-contained personal plugin that the plugin manager can install and upgrade without losing policy, skills, commands, extensions, or LSP overrides.

## What Changes

- Publish `.omp-plugin/marketplace.json` with marketplace `glockyco`, plugin `personal`, source `./plugin`, an explicit release version, and `lspServers: "./lsp/lsp.json"`; retain `plugin/package.json#omp.extensions` for both runtime modules.
- Adopt user-scoped marketplace installation and catalog refresh followed by explicit plugin upgrade. The isolated OMP 18.6.1 spike proved every capability loads; local-package installation misses LSP overrides and cannot upgrade.
- **BREAKING**: remove `packages.personal-omp-plugin` and `packages.default`, wrapper-consumer instructions, immutable-store delivery checks, and downstream runtime-pin release steps. Retain `lib.openspecCheck`, its independently pinned fleet consumers, the development shell, adapter generator, and quality gates.
- **BREAKING**: generated workflow commands use OMP's marketplace namespace (`/personal:opsx-*`) once each, with no bare-name aliases or extra `--extension` / `--plugin-dir` loading.
- Keep repository-only tests outside `plugin/`, preserve the complete runtime skills and notices, and replace package-shape checks with catalog and isolated real-install/discovery/upgrade checks in CI.
- Require matching catalog/payload semantic versions, a bump for every runtime release, explicit owner-authorized publication, and fresh-session acceptance before downstream consumption.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: replace Nix-store delivery with a versioned marketplace payload, preserve isolation and runtime independence, require complete isolated discovery and namespaced single command registration, and separate development files from installed runtime content.
- `plugin-update-automation`: retain dependency-update ownership and the Nix-selected development toolchain while replacing workstation runtime pin/activation release steps with versioned publication, native-manager upgrades, and real upstream OMP acceptance.

## Impact

Implementation affects `.omp-plugin/marketplace.json`, `plugin/package.json`, the location and references of `plugin/tests/`, `flake.nix`, `.github/workflows/ci.yml`, root release metadata, README, AGENTS guidance, and affected accepted specifications. `lib.openspecCheck` remains consumed through a Nix input; that input no longer delivers the runtime plugin.

This is fleet change 0, preceding `nix-config` changes 1–4. The published catalog must exist and pass its gates before changes 1 and 3 use the install commands. No implementation, publication, login, or live-state mutation is authorized by this planning change.

## Non-goals

No OMP installer/updater, Nix wrapper, compatibility command aliases, language-server installation, provider configuration, mutable-state synchronization, npm publication, or edits to the three unrelated active change directories. Plannotator's annotation behavior and native-Windows support are owned by its existing companion change; discovery here does not certify its Windows subprocess lifecycle or close its open acceptance task. The complete writing skill and its recorded redistribution risk remain unchanged.
