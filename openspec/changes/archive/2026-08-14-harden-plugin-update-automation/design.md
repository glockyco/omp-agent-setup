## Context

See `proposal.md` for motivation. The repository already has a Nix development shell, cross-system flake checks, Bun package checks, Renovate, and required status checks. CI separately installs Bun from `.bun-version`. Renovate does not detect Nix because its Nix manager is beta and disabled by default.

The scheduled updater must create a pull request as an actor whose event starts normal CI. A default `GITHUB_TOKEN` leaves that run subject to manual approval. Long-lived personal tokens are not acceptable.

## Goals / Non-Goals

**Goals:**

- Make `flake.lock` and JavaScript update ownership exhaustive and non-overlapping.
- Use the Nix-selected Bun executable everywhere.
- Use a short-lived, least-privilege automation identity.
- Make generated OpenSpec instructions testable repository artifacts.
- Make the actual cross-system checks mandatory before merge.

**Non-Goals:**

- Automatic merge, publication, downstream activation, or runtime smoke.
- Renovate's beta Nix manager.
- A custom update CLI or a second package manager wrapper.
- Changes to the immutable plugin capability bundle.

## Decisions

### Nix is the Bun version authority

Remove `.bun-version` and `oven-sh/setup-bun`. CI enters `nix develop` for `bun install --frozen-lockfile` and `bun run ci`. The flake development shell remains the only Bun selection point. A flake check executes `bun --version` and compares it with Nix package metadata.

This removes a version pair that Renovate could update independently. Keeping both pins with an equality assertion was rejected because routine Renovate pull requests would fail until an unrelated nixpkgs update became available.

### Specialized update owners remain separate

Renovate owns `package.json`, `bun.lock`, shared Renovate configuration, and GitHub Actions. `DeterminateSystems/update-flake-lock` owns Nix inputs. Configure `nix.enabled=false` in `renovate.json` so ownership is explicit even if Renovate later enables the manager by default.

A custom dependency service was rejected. The two selected tools already understand their native lock formats.

### A repository-scoped GitHub App supplies update tokens

Create one private GitHub App installed only on `omp-agent-setup` and `nix-config`. Grant metadata read, contents read/write, and pull requests read/write. Store the client ID as an Actions variable and its private key as an Actions secret in each repository.

Each update workflow uses a pinned `actions/create-github-app-token` action. The resulting installation token is short-lived and is passed to the official flake updater. A personal access token was rejected because it is long-lived and tied to a human account.

### Flake updates remain one atomic weekly pull request

The plugin has only two direct flake inputs. One weekly and manually dispatchable workflow updates the complete lock. It uses a stable branch name and does not enable automerge. A no-change run produces no pull request.

Splitting two inputs into independent workflow abstractions was rejected because the same cross-system checks validate their composition and the added orchestration has no current benefit.

### Adapter freshness is a pure flake check

Add OpenSpec to the development shell. A flake check copies the repository source to a writable temporary directory, runs the selected `openspec update`, and compares tracked `.omp/commands` and `.omp/skills` with the source. It sets the CI and telemetry opt-out environment variables so generation is noninteractive and performs no version probe. It never writes into the checkout. A generator change therefore produces a deterministic failing check and a reviewable remediation.

Use OpenSpec 1.9's strict active-contract validation and `validate --archived` in a second check. This catches scenario loss, invalid task numbering, and incomplete archived work without source-text parsing.

### Repository settings enforce the contract

Require the workflow's exact `check (macos-15)` and `check (ubuntu-latest)` contexts. Require an up-to-date pull request and linear history. Disable force-push and deletion. Apply the policy to administrators. Do not require an approval count for this single-maintainer repository.

## Risks / Trade-offs

- GitHub App creation and private-key rotation are external administrative operations. The runbook records ownership and rotation without committing credentials.
- Running full Bun CI through Nix can add startup time. It removes larger version-skew risk and uses existing caches.
- OpenSpec adapter generation can change across releases. A failing freshness check intentionally requires review instead of silent regeneration.
- Enforced administrator policy removes direct emergency pushes. Nix rollback remains the operational recovery path; repository rules can be changed through GitHub administration only during a documented emergency.
