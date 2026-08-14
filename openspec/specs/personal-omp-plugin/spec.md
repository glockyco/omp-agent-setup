# personal-omp-plugin Specification

## Purpose
Define the immutable personal OMP capability bundle that a pinned workstation configuration can load without mutating OMP-owned state.

## Requirements

### Requirement: Immutable plugin package

The flake SHALL export a default package whose root is a valid OMP plugin directory with a package manifest, rules, skills, extensions, and only proven LSP overrides.

#### Scenario: Build the package

- **WHEN** a supported flake system builds `packages.default`
- **THEN** the output contains only the declared personal plugin capabilities and no mutable checkout paths

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, or mutable configuration database.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the packaged plugin under a disposable profile
- **THEN** personal policy, three personal skills, one commit tool, and the declared LSP overrides are discoverable without personal agents or model changes

### Requirement: Runtime independence

Loading the package SHALL NOT require a global Bun, npm, Python, .NET, or Homebrew installation.

#### Scenario: Load from an isolated environment

- **WHEN** OMP starts with the plugin store path and a restricted executable path
- **THEN** plugin discovery succeeds and performs no dependency installation

### Requirement: Short personal policy

The always-applied policy SHALL contain only personal deviations: STE-based technical prose, host-native interface verification, structured commit transport, and causal commit bodies.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy states the four deviations without duplicating OMP's general engineering policy

### Requirement: Generated adapter freshness

The repository SHALL verify that its tracked OpenSpec commands and skills match the locked OpenSpec generator. An OpenSpec update SHALL fail the release gate until generated changes are reviewed and committed.

#### Scenario: OpenSpec changes generated instructions

- **WHEN** the locked OpenSpec package would rewrite a tracked command or skill
- **THEN** the release gate fails and identifies the generated adapter drift

### Requirement: Archived change completeness

The repository SHALL reject an archived OpenSpec change that contains an incomplete task. Strict validation SHALL also retain scenario and task-numbering checks for active contracts.

#### Scenario: An incomplete change is archived

- **WHEN** an archived change contains an unchecked task
- **THEN** the plugin release gate fails

### Requirement: Development payload separation

Development tools, generated planning adapters, and repository tests SHALL remain outside the default immutable plugin payload unless OMP needs them at runtime.

#### Scenario: Inspect the default package

- **WHEN** a supported system builds the default plugin package
- **THEN** the output contains the declared runtime plugin tree and excludes repository-only update automation
