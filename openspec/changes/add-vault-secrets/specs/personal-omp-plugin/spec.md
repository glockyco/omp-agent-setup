# Spec Delta

## MODIFIED Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, general-purpose mutable configuration database, or Simplified Technical English skill. The installed release SHALL contain its complete declared runtime assets without depending on the source checkout. Private mutable state SHALL be limited to the vault-access contract and SHALL remain outside the installed payload.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **THEN** every shipped always-applied rule, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, the vault tools, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance
- **AND** every declared extension module loads without import or registration errors

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **AND** no repository provides a command of the same exposed name
- **THEN** each generated workflow command is invocable under its marketplace name
- **AND** command and skill assets resolve from the installed release rather than a source checkout

### Requirement: Native marketplace delivery

The repository SHALL publish marketplace `glockyco` with plugin `personal` and runtime identity `personal@glockyco`. Its catalog SHALL identify a self-contained plugin payload, an explicit semantic release version, and an LSP configuration contained within that payload. The payload SHALL declare every runtime extension module through its OMP package manifest.

#### Scenario: Document native installation and upgrade

- **WHEN** a maintainer follows the documented runtime delivery procedure
- **THEN** installation uses `omp plugin marketplace add glockyco/omp-agent-setup` followed by `omp plugin install --scope user personal@glockyco`
- **AND** upgrade uses `omp plugin marketplace update glockyco` followed by `omp plugin upgrade --scope user personal@glockyco` and a fresh OMP session
- **AND** runtime publication neither requires nor exposes a Nix plugin package output, while independent shared OpenSpec validation remains available

#### Scenario: Install the published personal plugin

- **WHEN** the documented user-scoped marketplace installation runs in a fresh OMP profile
- **THEN** OMP lists one enabled personal marketplace release at the advertised version
- **AND** its payload resolves from the plugin manager's installed cache, not a mutable repository checkout

#### Scenario: Consume shared OpenSpec validation

- **WHEN** a Nix repository consumes `lib.openspecCheck` from this repository
- **THEN** it can continue strict and archive-completeness validation through that independently pinned interface
- **AND** runtime plugin installation does not depend on that Nix input or a default plugin package

## ADDED Requirements

### Requirement: Scoped vault runtime state

The plugin SHALL permit extension-owned vault profiles, approvals, OS-protected cache material and operation recovery state beneath `~/.omp` only as specified by vault-access. It SHALL NOT write unrelated OMP state, store credentials in the payload, install Bitwarden, or create a second delivery owner.

#### Scenario: Load without Bitwarden

- **WHEN** the manager-installed plugin loads with no `bw` on PATH
- **THEN** all extension factories and non-vault capabilities remain discoverable
- **AND** the vault capability explains its missing host prerequisite only when used
- **AND** loading does not create a logged-in profile or prompt for credentials

#### Scenario: Installed vault capability verification

- **WHEN** the isolated release gate loads the installed candidate
- **THEN** it verifies vault registration and stub-CLI privacy behavior from the installed cache without a real vault or provider credential
- **AND** every vault state path stays within the redirected disposable home
- **AND** absence or damage of the vault extension fails the gate
