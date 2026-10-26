## Context

See proposal.md for the failure boundary. The native generator and shared workflow already compare against the root development dependency, while the Nix app, checks and shell select OpenSpec from `llm-agents`. A lock refresh therefore changes an undeclared generator input. Retained repositories still consume `lib.openspecCheck`, so deleting Nix support is not a valid fix.

## Goals / Non-Goals

- Select one exact CLI version across repository execution paths and make drift visible in CI.
- Preserve offline Nix builds and the retained validator interface.
- Keep unrelated `llm-agents` updates, including OMP, independent of OpenSpec selection.
- Do not upgrade OpenSpec, publish a plugin release, change consumer pins or replace host-owned tools in this fix.

## Decisions

### Root npm dependency is the version authority

Nix reads the exact version directly from the root manifest. Its local package uses fixed source and dependency hashes plus a vendored npm lock, whose root identities must match that version. The hash metadata contains no separate version field. The locked upstream package recipe and dependency lock provide the initial reviewed packaging inputs, not an ongoing package selection.

### Reusable workflow is an enforced generated mirror

A reusable workflow checks out the caller, so the caller's package.json cannot choose the publisher's CLI. GitHub does not provide a general publisher-manifest path to the called workflow. Keep its exact install literal as generated output and enforce equality with the canonical dependency. The existing synchronization command refreshes that mirror and both documented offline-hook comparisons and diagnostics before adapter generation. Missing or duplicate mirror anchors fail rather than silently writing a partial update. Renovate leaves the canonical dependency alone, because a pull request that changes it without regenerating the mirrors, the Nix lock, its hashes and the adapters cannot pass. The coordinated synchronization is the only update path, as it already is for OMP releases.

### Package and test the Nix execution boundary

Use one local `buildNpmPackage` derivation in the sync app, dev shell, artifact validator and adapter check. Preserve the `lib.openspecCheck` arguments and artifact-only source filtering. Export the package and a runtime version check so the actual executable, not merely a declaration, proves parity.

GitHub runs the Nix version, adapter and contract derivations in a separate Ubuntu job. The platform-independent byte comparison then reports a failing check before merge. Native three-host CI remains unchanged and continues its own generation, hook and artifact tests. Full native Nix verification remains required for the retained release gate.

## Evidence

The initial Nix recipe and npm lock come from immutable `numtide/llm-agents.nix` revision `9951a863920a417a4a4613476089977320520252`, whose OpenSpec source and dependency hashes identify the current npm CLI. The newer lock proposed in PR #88 instead selects OpenSpec 1.15.0 upstream, which exposed this independent selection.

OpenSpec 1.15.0 was published to npm at 2026-10-24T00:51:18.868Z. The inherited 72-hour npm release-age condition does not permit that coordinated update before 2026-10-27T00:51:18.868Z. This fix retains the current canonical version.

## Risks / Trade-offs

- The reusable workflow still embeds generated version text. Behavioral mirror checks and a single updater target prevent it from becoming an independent selection.
- Nix needs its own reproducible npm dependency lock. Identity assertions and the native parity gate reject stale lock metadata, while real Nix builds validate the dependency hashes.
- CI gains a Nix installation and build job. It builds only the OpenSpec boundary, not a second complete installed-release matrix.

## Migration Plan

Replace the repository's Nix selections and activate the CI check together. Keep every retained caller unchanged. Verify current native and Nix paths, then verify the updater's regenerated age-compliant lock against the same package selection before merging that lock PR.

## Workflow follow-up

- Archive this change after the implementation PR is green and merged.
- Assess the coordinated OpenSpec upgrade through the canonical pin only after its release-age threshold is met.
