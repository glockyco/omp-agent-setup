## 1. Canonical Native Selection

- [x] 1.1 Derive workflow and both offline-hook mirrors from the root npm dependency in adapter synchronization, preserving unrelated bytes and line endings.
- [x] 1.2 Reject stale, missing or ambiguous mirrors and both stale Nix lock root identities in native checks, with executable fixture regressions.
- [x] 1.3 Remove the independent workflow-version update manager and update contributor guidance for coordinated synchronization.

## 2. Reproducible Nix Execution

- [x] 2.1 Add the repository-owned npm CLI package with fixed source and dependency inputs and no independent version selector.
- [x] 2.2 Route every Nix OpenSpec execution through that package while preserving `lib.openspecCheck` and artifact-only caching.
- [x] 2.3 Add the actual executable version check and the Ubuntu Nix version, adapter and contract CI job without replacing native checks.

## 3. Integration Acceptance

- [x] 3.1 Run native toolchain, formatting, type, dead-code, behavior/coverage, adapter and strict artifact checks with the selected native toolchain.
- [x] 3.2 Run the complete native Nix flake check, including the installed-release gate, on the supported Darwin host.
- [x] 3.3 Obtain all native, shared OpenSpec and new Nix CI contexts on the implementation PR.
- [x] 3.4 Confirm the updater's regenerated lock does not change the repository-selected OpenSpec executable and passes native Nix checks before merging its PR.

## Workflow follow-up

- Archive after the implementation PR is green and merged.
- Move the canonical CLI to a newer release only after its release-age condition is satisfied, then regenerate all associated artifacts and verify that coordinated update independently.
