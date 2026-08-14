## Why

The current setup mutates global OMP state, patches installed source, and depends on a Bun checkout. The accepted workstation architecture requires reusable personal behavior as one immutable, Nix-pinned OMP plugin before host cutover can remove that mutable deployment path.

## What Changes

- Add a flake that exports the personal OMP plugin as an immutable package directory.
- Replace the broad global guidance with one short personal-policy rule.
- Package traceable ASD-STE100 guidance, the consolidated research workflow, and a structured commit extension.
- Retain only LSP overrides proven by representative scenarios.
- Add isolated checks that exercise OMP discovery and the commit transport without a real user profile.
- **BREAKING**: After workstation cutover, retire bootstrap deployment, OMP source patching, executable repointing, personal agents, local-model support, and global planning helpers.

## Capabilities

### New Capabilities

- `personal-omp-plugin`: Immutable plugin packaging, capability discovery, and isolation boundaries.
- `simplified-technical-english`: Traceable STE-based technical-writing guidance with complete rule identifiers.
- `research-evidence`: One evidence workflow from search through citation registration, including controlled Sci-Hub acquisition.
- `structured-commit`: Semantic commit policy plus structured, hook-preserving commit transport.

### Modified Capabilities

None. This repository has no accepted OpenSpec specifications yet.

## Impact

- Adds `flake.nix`, `flake.lock`, the curated plugin source, OpenSpec project state, and package-level checks.
- Reuses and refactors selected payloads from `agent/`; legacy installer code remains only until `nix-darwin` consumes and verifies the package.
- Gives `nix-darwin` a stable `packages.default` input and removes the need for global Bun, npm, Python, .NET, or Homebrew runtime dependencies in the plugin.
