## MODIFIED Requirements

### Requirement: Generated adapter freshness

The repository SHALL verify in its own native Linux, macOS, and Windows CI that the generated OpenSpec commands and skills in the plugin payload match the centrally pinned npm OpenSpec generator without requiring Nix. An OpenSpec update SHALL fail the release gate until generated changes are reviewed and committed.

Verification SHALL compare the payload rather than any repository-level adapter directory, and SHALL leave the working tree unchanged. Consumers SHALL NOT run this repository's adapter-freshness check as their artifact-validation gate. The native regeneration command SHALL preserve the generator as the only writer of these payload paths.

#### Scenario: OpenSpec changes generated instructions

- **WHEN** the pinned OpenSpec package would rewrite a generated command or skill in the payload
- **THEN** the release gate fails and identifies the generated adapter drift

#### Scenario: Payload is current

- **WHEN** the pinned generator reproduces the payload exactly
- **THEN** the release gate passes and the working tree is unchanged

#### Scenario: A generated adapter is missing from the payload

- **WHEN** the payload lacks a command or skill the generator produces
- **THEN** the release gate fails

#### Scenario: Native Windows adapter check

- **WHEN** the native Windows contributor or runner checks adapter freshness with the pinned generator
- **THEN** a disposable root reproduces and compares all generated commands and skills without Nix or WSL
- **AND** extra payload adapters and missing generated adapters also fail

### Requirement: Isolated complete release verification

The release gate SHALL validate the catalog and demonstrate actual install, runtime discovery, and upgrade under a temporary HOME with isolated configuration, data and cache roots on Linux, macOS, and native Windows. It SHALL use no provider credentials or model request, SHALL leave real OMP state unchanged, and SHALL remove its temporary profiles. CI SHALL provision the selected exact OMP release through the official binary installer into scratch and use its absolute executable; it SHALL NOT depend on Nix or a contributor's host OMP installation. Windows home, application-data, and temporary roots SHALL remain isolated as well.

Verification SHALL observe both declared extension factories, the commit tool, all three annotation command registrations, all declared skills and their support assets, the always-applied personal policy, each workflow command exactly once, and every declared LSP override. A list or doctor result alone SHALL NOT satisfy runtime verification. Deterministic executable probes MAY prove configuration selection but SHALL NOT be reported as real language-server protocol or native-browser acceptance. No platform SHALL skip an existing positive or negative capability/upgrade control because its Unix process or terminal fixture is unavailable.

#### Scenario: Complete marketplace release is tested

- **WHEN** the gate installs the candidate catalog into a disposable profile
- **THEN** it observes all declared runtime capabilities from that installed release and no duplicate workflow commands
- **AND** Marksman remains unselected when both Marksman and Markdown Oxide executable probes are available with matching root markers
- **AND** real user OMP state is unchanged and temporary profiles are removed

#### Scenario: Catalog omits the LSP delivery field

- **WHEN** an otherwise valid candidate catalog no longer delivers the personal LSP overrides
- **THEN** the release gate fails on the lost override or active Marksman rather than accepting successful installation

#### Scenario: Capability registration is lost

- **WHEN** a candidate loses a declared extension, skill, rule, command, or required skill support asset
- **THEN** the release gate fails and identifies the missing capability or asset

#### Scenario: Native Windows complete gate

- **WHEN** CI runs the selected official OMP binary and candidate personal release on Windows
- **THEN** actual installation, fresh capability discovery, terminal-observed LSP selection, installed-cache behavior tests, damaged-candidate controls, and upgrade/state preservation execute without WSL or Nix
- **AND** temporary HOME, USERPROFILE, APPDATA, LOCALAPPDATA, and temp roots contain the test's state and are cleaned afterward

#### Scenario: Isolated gate fails during a terminal probe

- **WHEN** a capability or terminal observation fails or times out on any supported host
- **THEN** the gate reports the failed capability and releases its owned terminal, subprocess tree, and disposable state
- **AND** it does not declare that scenario skipped or leave a real user-profile installation

## ADDED Requirements

### Requirement: Native repository hooks

Repository development and Git hooks SHALL run the pinned native toolchain on Linux, macOS, and Windows without Nix. Hooks SHALL retain staged formatting, type checks, commit-message validation, frozen dependency installation, and full pre-push CI; they SHALL use installed development tools without fetching a missing executable.

#### Scenario: Commit from a native Windows client

- **WHEN** a native Windows Git client invokes the installed repository hooks after documented setup
- **THEN** formatting/type checks and commit-message validation run without a Nix shell or WSL
- **AND** a failed applicable hook prevents the Git operation

#### Scenario: Push runs from a Git hook environment

- **WHEN** the pre-push hook inherits Git's repository-local environment variables
- **THEN** its native CI child receives the correctly sanitized environment and runs frozen installation plus the full gate
- **AND** sanitization does not depend on POSIX shell substitution or mutate the parent environment
