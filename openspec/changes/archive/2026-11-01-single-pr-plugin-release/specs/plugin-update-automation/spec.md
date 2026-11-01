# Spec Delta

## ADDED Requirements

### Requirement: Single pull request per release

Each plugin runtime release SHALL use one pull request containing the implementation, matching catalog, payload and root manifest version bumps, and its completed archived OpenSpec change. Publication SHALL retain an immutable version tag on the reviewed release commit. Release completion SHALL NOT require a separate archive pull request or routine manual per-host installation, upgrade or fresh-session smoke checks.

#### Scenario: Review a runtime release

- **WHEN** a runtime release pull request is ready to merge
- **THEN** its implementation, matching version bumps, accepted specs and archived change are reviewed together after applicable checks pass
- **AND** no later archive pull request or routine two-host smoke is needed

#### Scenario: Documentation-only update

- **WHEN** a pull request changes documentation or accepted procedure without changing the distributed runtime
- **THEN** its plugin version may remain unchanged

## MODIFIED Requirements

### Requirement: Enforced cross-system checks

The main branch SHALL require the current Linux, macOS, Windows, and shared OpenSpec CI job contexts for all actors, including administrators and automation. When selected by path classification, every native platform SHALL run equivalent formatting, type, dead-code, audit, release-tree/version, behavior/coverage, adapter-freshness, and isolated installed-release checks without Nix. Force-push and branch deletion SHALL remain disabled.

#### Scenario: A required check fails

- **WHEN** an update pull request has a failing required job
- **THEN** GitHub prevents the pull request from merging

#### Scenario: Windows check fails while Unix checks pass

- **WHEN** native Windows CI detects a process, path, hook, or release-gate regression while Linux/macOS jobs pass
- **THEN** branch protection still prevents merge for humans and automation
- **AND** no platform skips the affected observable gate merely because a Unix fixture is unavailable

### Requirement: Deliberate runtime release

Renovate MAY merge minor, patch and lockfile development updates under the shared preset after required checks pass. Plugin behavior, native release-tool pins and retained `llm-agents` changes SHALL require human review, applicable gates and explicit authorization before publication or downstream consumption. Runtime releases SHALL use native marketplace delivery, not Nix runtime pins, wrappers or plugin-package activation.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
- **AND** the release is versioned, reviewed and explicitly authorized for publication before nix-config consumes it
- **AND** the downstream host retains its previous deployment until its applicable release checks pass
- **AND** authentication and elevated host operations remain interactive
- **AND** behavior-changing pushes, merges and release tags require explicit authorization

#### Scenario: Verify the new deployment

- **WHEN** isolated installed-release CI verifies a candidate through the native manager
- **THEN** a fresh isolated OMP session observes the advertised version, complete capabilities and always-applied rules in the system prompt
- **AND** no manual fresh-session check on macbook-pro or Korolev is required for routine release acceptance
- **AND** nix-config owns hourly host plugin upgrades independently of release completion
- **AND** no wrapper or Nix runtime-package activation is needed to expose the plugin
- **AND** publication and plugin upgrades do not implicitly update upstream OMP or vice versa

#### Scenario: Official binary CI finishes

- **WHEN** release verification completes with an isolated official OMP binary
- **THEN** Korolev's Tern-managed executable and real OMP state remain unchanged
- **AND** actual host UI acceptance for changed visual behavior remains required and separate from routine installed-release CI evidence

#### Scenario: Safe development update is eligible for preset automerge

- **WHEN** Renovate proposes a minor, patch or lockfile development update
- **THEN** the repository does not override the shared preset's automerge or release-age policy
- **AND** Bun retains its three-day resolution gate
- **AND** a dependency merge does not publish a plugin release or upgrade a host
