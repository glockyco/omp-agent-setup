# Proposal

## Why

Korolev is becoming Windows-only, but the installed personal plugin rejects native Windows annotation and this repository's development, hooks, release checks, and shared OpenSpec validation require Nix. Personal capabilities must continue working on Korolev and the private macbook-pro without making a Windows contributor enter WSL.

## What Changes

- Accept local interactive Windows TUI sessions for `/plannotator-annotate`, `/plannotator-last`, and `/plannotator-cancel`; replace the POSIX-only cleanup assumption with owned process-tree termination while preserving Unix behavior, local-only refusals, snapshots, and exactly-once feedback.
- **BREAKING development contract:** use one explicit Bun pin, native dependency installation and lefthook commands, and equivalent Linux/macOS/Windows CI instead of the locked Nix shell. Keep the isolated Python release gate, add native Windows terminal/process fixtures, obtain its pinned test OMP from a fixed release-asset URL verified against six reviewed repository digests rather than runtime metadata or an installer that edits the user PATH, and OpenSpec from npm. Update the OMP tag/digests together through an explicit maintainer command; no tag-only automation.
- Publish `.github/workflows/openspec.yml` as a reusable `workflow_call` gate with centrally pinned OpenSpec, the mandatory archive-support guard, and both strict validation commands. Document local hooks using the host's OpenSpec; check generated-adapter freshness in this repository's CI.
- Retain `lib.openspecCheck` unchanged for unmigrated consumers. Removing the flake is a separately gated follow-up after nix-config, phd-thesis, and test-generalization migrate, not a prerequisite for native development.
- Update existing development, release, host-prerequisite, and update-ownership guidance; remove the research helper's stale Nix-patched-shebang claim and prove explicit host-Python invocation and hook-preserving Git commits on Windows.

## Capabilities

### New Capabilities

None. `omp-visual-feedback` is now an accepted main capability after the authorized `2026-10-11-add-plannotator-visual-feedback` archive; this change does not introduce a second owner.

### Modified Capabilities

- `omp-visual-feedback`: extend its accepted owned lifecycle and local subprocess requirements to Windows and native document paths. The original acceptance, synchronization and archive prerequisite was verified before implementation; its historical evidence remains intact.
- `plugin-update-automation`: replace Nix-selected Bun with a single native pin, broaden required CI to Windows, and give Renovate ownership of the new native pins while retaining central ownership of residual flake inputs.
- `fleet-openspec-validation`: add portable shared-workflow delivery and host-local verification, preserve centralized CI version ownership, and explicitly distinguish artifact validation from Nix cache reuse.
- `personal-omp-plugin`: require Nix-free cross-system release verification and native adapter freshness while preserving payload independence and marketplace delivery.
- `research-evidence`: make the existing PDF helper's invocation portable without changing acquisition precedence, identity, metadata, or evidence semantics.
- `structured-commit`: require existing hook-preserving Git transport to work with native Windows paths as well as Linux/macOS.

## Impact

Implementation targets are `plugin/extensions/plannotator.ts`, `tests/plannotator.test.ts`, `tests/release_gate.py`, `tests/personal-commit.test.ts`, `tests/release-tree.test.ts`, `scripts/release.ts`, `package.json`, `bun.lock`, `lefthook.yml`, `renovate.json`, `.github/workflows/ci.yml`, the new reusable workflow and repository-only native gate/adapter scripts, README, AGENTS, and research-helper guidance. Runtime changes require a newer synchronized personal plugin release version.

`nix-config/retire-korolev-wsl-host` consumes the reviewed shared-workflow release; `nix-config/make-korolev-windows-native` depends on this plugin release for Windows Plannotator acceptance. Neither host installation is implemented here: Korolev keeps Tern-managed OMP (`%LOCALAPPDATA%\Tern\omp\bin\omp.exe`, currently 18.8.7), while CI uses an isolated official binary. Docker Desktop, TeX Live/TexLab and other Windows tooling, WSL retirement, OMP memory migration, and the private booking marketplace have separate owners.

`retire-legacy-planning-archive` remains independent; preserve its disposition and deletion scope when updating AGENTS. `add-research-paper-writing-skill` is complete but unarchived: preserve its skill assets and third-party rights record, and do not restore its historical Nix-store/wrapper delivery instructions.
