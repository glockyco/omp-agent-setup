## Context

See `proposal.md` for motivation. The App currently has one installation across selected repositories, so every copy of its private key can mint tokens for every repository in that installation. GitHub has no account-level Actions secret for personal repositories. The target repository already has fail-closed Darwin and Linux CI and a Renovate rule that reserves Nix inputs.

## Goals / Non-Goals

**Goals:**

- Keep one App private key in one protected control-plane repository.
- Preserve repository-scoped installation tokens and normal target pull-request CI.
- Keep the complete Nix update and changed-path contract explicit.

**Non-Goals:**

- Centralize target CI or merge decisions.
- Give Renovate ownership of Nix inputs.
- Add a generic package-manager abstraction.

## Decisions

### Use one protected control plane

`glockyco/dependency-automation` stores the App key, schedule, and managed-repository registry. One matrix job mints a token restricted to `omp-agent-setup`, runs `nix flake update`, and permits only `flake.lock` to change.

Keeping the local workflow was rejected because it would retain one fleet-wide private key in every target. Creating one App per repository was rejected because App and key rotation overhead would grow with the fleet. A central controller limits the credential trust root without changing target ownership.

### Keep validation in the target repository

The controller creates a review-only App-authored pull request. `omp-agent-setup` continues to run its normal Darwin and Linux checks and remains protected by those required contexts.

Moving CI into the controller was rejected because dependency behavior belongs to the target revision and platform matrix. Dispatching CI separately was rejected because it loses pull-request event semantics.

### Preserve native update commands

The controller stores commands as argument arrays and executes `nix flake update` directly. It fails if the command changes a path outside the target allowlist.

A target-local wrapper was rejected because this repository needs no post-update generation. The explicit native command is smaller and does not create a second interface.

## Risks / Trade-offs

- [The controller becomes a privileged dependency] → Protect its main branch, pin Actions, and require its validation check.
- [The controller registry and target policy can drift] → Keep Renovate's Nix manager disabled locally and require a targeted live run for every registry change.
- [A central outage pauses Nix updates] → Keep the documented manual `nix flake update` recovery path. No runtime or release path depends on the controller.

## Migration Plan

1. Publish and protect `glockyco/dependency-automation`.
1. Install the App on every registered target and configure the key only in the controller.
1. Run a targeted plugin update and verify App authorship plus normal target CI.
1. Remove the local updater workflow, variable, and secret.
1. Close the obsolete updater branch and pull request.

Rollback restores the target-local workflow and its App configuration from the previous revision. The manual update path remains available throughout migration.
