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
- **THEN** personal policy, the personal skills, the generated OpenSpec workflow skills and commands, one commit tool, and the declared LSP overrides are discoverable without personal agents or model changes

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the packaged plugin under a disposable profile
- **AND** no repository provides a command of the same name
- **THEN** each generated workflow command is invocable

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

### Requirement: Single source for the OpenSpec workflow

The plugin SHALL be the only tracked source of the generated OpenSpec workflow adapters. A repository that consumes the workflow SHALL NOT track its own copy of a generated command or skill.

A repository MAY still define a command or skill of the same name to override the plugin's, and SHALL do so only to express a repository-specific deviation.

Rationale: identical generated files committed into repositories with their own formatting regimes acquire two owners and diverge. Three distinct contents already exist across nine roots that all report the same generator version.

#### Scenario: Working in any repository

- **WHEN** a session starts in a repository that uses the workflow
- **THEN** the OpenSpec commands and skills are available from the plugin
- **AND** the repository tracks no copy of them

#### Scenario: Repository-specific override

- **WHEN** a repository defines a command or skill whose name matches one the plugin provides
- **THEN** the repository's definition takes effect in that repository
- **AND** the plugin's definition remains in effect everywhere else

#### Scenario: Repository-specific capabilities are unaffected

- **WHEN** a repository defines a skill or rule that the plugin does not provide
- **THEN** it remains tracked in that repository and keeps working

### Requirement: Workflow commands register once

Each generated workflow command SHALL register exactly once, under its own name. It SHALL NOT also register under a name derived from the package location.

The payload SHALL expose its LSP overrides in a root that carries no commands, so that loading those overrides does not register the workflow a second time.

#### Scenario: Loading the workstation configuration

- **WHEN** OMP loads the plugin the way the workstation wrapper does
- **THEN** each workflow command appears once in the command list
- **AND** no command appears under a name derived from the package location

#### Scenario: LSP overrides still apply

- **WHEN** OMP loads the plugin the way the workstation wrapper does
- **AND** a project matches an overridden server's root markers
- **AND** that server's binary resolves
- **THEN** the override is in effect

### Requirement: Generated adapter freshness

The repository SHALL verify that the generated OpenSpec commands and skills in the plugin payload match the locked OpenSpec generator. An OpenSpec update SHALL fail the release gate until generated changes are reviewed and committed.

Verification SHALL compare the payload rather than any repository-level adapter directory, and SHALL leave the working tree unchanged.

#### Scenario: OpenSpec changes generated instructions

- **WHEN** the locked OpenSpec package would rewrite a generated command or skill in the payload
- **THEN** the release gate fails and identifies the generated adapter drift

#### Scenario: Payload is current

- **WHEN** the locked generator reproduces the payload exactly
- **THEN** the release gate passes and the working tree is unchanged

#### Scenario: A generated adapter is missing from the payload

- **WHEN** the payload lacks a command or skill the generator produces
- **THEN** the release gate fails

### Requirement: Archived change completeness

The repository SHALL reject an archived OpenSpec change that contains an incomplete task. Strict validation SHALL also retain scenario and task-numbering checks for active contracts.

#### Scenario: An incomplete change is archived

- **WHEN** an archived change contains an unchecked task
- **THEN** the plugin release gate fails

### Requirement: Development payload separation

Development tools and repository tests SHALL remain outside the default immutable plugin payload.

Generated planning adapters SHALL be included in the payload, because OMP needs them at runtime: the payload is their only tracked source, and consuming repositories rely on it to provide the workflow.

The generated payload SHALL be written only by the generator. Repository formatting SHALL NOT rewrite it, so that reproducing it byte for byte remains a meaningful check.

#### Scenario: Inspect the default package

- **WHEN** a supported system builds the default plugin package
- **THEN** the output contains the declared runtime plugin tree including the generated workflow adapters
- **AND** excludes repository-only update automation and repository tests

#### Scenario: Formatter runs over the repository

- **WHEN** the repository's formatter runs across tracked files
- **THEN** it does not modify the generated payload
