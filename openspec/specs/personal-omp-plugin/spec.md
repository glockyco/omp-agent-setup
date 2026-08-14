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

