## MODIFIED Requirements

### Requirement: Deliberate runtime release

Renovate MAY merge minor, patch and lockfile development updates under the shared preset after required checks pass. Plugin behavior, native release-tool pins and retained `llm-agents` changes SHALL require human review, applicable gates and explicit authorization before publication or downstream consumption. Runtime releases SHALL use native marketplace delivery and fresh host-managed OMP sessions in Tern, not Nix runtime pins, wrappers or plugin-package activation.

#### Scenario: Merge a behavior update

- **WHEN** a reviewed dependency update changes runtime behavior
- **THEN** no automation activates it on the workstation before the downstream release procedure succeeds
- **AND** the release is versioned, reviewed and explicitly authorized for publication before nix-config consumes it
- **AND** the downstream host retains its previous deployment until its applicable release checks pass
- **AND** authentication and elevated host operations remain interactive
- **AND** behavior-changing pushes, merges and release tags require explicit authorization

#### Scenario: Verify the new deployment

- **WHEN** the published personal plugin is upgraded through the native manager
- **THEN** a fresh host-managed OMP session in Tern observes the advertised installed version and exercises the changed capability
- **AND** no wrapper or Nix runtime-package activation is needed to expose the plugin
- **AND** publication and plugin upgrades do not implicitly update upstream OMP or vice versa

#### Scenario: Official binary CI finishes

- **WHEN** release verification completes with an isolated official OMP binary
- **THEN** Korolev's Tern-managed executable and real OMP state remain unchanged
- **AND** actual host acceptance remains separate from that CI evidence

#### Scenario: Safe development update is eligible for preset automerge

- **WHEN** Renovate proposes a minor, patch or lockfile development update
- **THEN** the repository does not override the shared preset's automerge or release-age policy
- **AND** Bun retains its three-day resolution gate
- **AND** a dependency merge does not publish a plugin release or upgrade a host
