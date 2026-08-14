## Why

The plugin runtime is immutable, but its maintenance path still has two Bun pins and no automated owner for Nix flake inputs. Dependency pull requests must use one pinned toolchain and must pass enforced Darwin and Linux checks before merge.

## What Changes

- Run all Bun development and CI commands through the Nix development shell.
- Remove `.bun-version` and the separate `setup-bun` CI installation.
- Add a weekly, review-only `flake.lock` update pull request that uses a short-lived GitHub App token.
- Keep Renovate responsible for JavaScript dependencies and GitHub Actions, and explicitly disable its beta Nix manager.
- Add generated OpenSpec adapter freshness, archived-task completeness, and Bun runtime checks.
- Document update ownership, manual commands, release smoke requirements, and rollback boundaries.
- Correct remote branch protection so the actual Darwin and Linux jobs are required for administrators and automation.

## Capabilities

### New Capabilities

- `plugin-update-automation`: Defines deterministic dependency ownership, one Nix-selected Bun toolchain, tested update pull requests, and required merge policy for the personal plugin repository.

### Modified Capabilities

- `personal-omp-plugin`: Extends package maintenance requirements with generated-adapter freshness while preserving the immutable runtime payload.

## Impact

- Affected files: `flake.nix`, `.github/workflows/`, `renovate.json`, `.bun-version`, package checks, repository guidance, and OpenSpec adapters.
- External state: one least-privilege GitHub App installation, Actions credentials, and corrected branch protection.
- No runtime capability, OMP state, provider, model, or workstation activation behavior changes.
