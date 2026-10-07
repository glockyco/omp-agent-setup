## REMOVED Requirements

### Requirement: Immutable plugin package

**Reason:** Runtime delivery moves to upstream OMP's plugin manager; a Nix default runtime package and wrapper would preserve a second delivery owner.

**Migration:** Publish the versioned `personal@glockyco` marketplace payload, migrate consumers to user-scoped native installation and upgrade, and remove `packages.personal-omp-plugin`, `packages.default`, and wrapper-consumer guidance. Retain the independent `lib.openspecCheck` fleet interface.

## MODIFIED Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, mutable configuration database, or Simplified Technical English skill. The installed release SHALL contain its complete declared runtime assets without depending on the source checkout.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **THEN** personal policy, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance
- **AND** both declared extension modules load without import or registration errors

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **AND** no repository provides a command of the same exposed name
- **THEN** each generated workflow command is invocable under its marketplace name
- **AND** command and skill assets resolve from the installed release rather than a source checkout

### Requirement: Runtime independence

Loading the installed release SHALL NOT require a global Bun, npm, Python, .NET, or Homebrew installation. OMP's own runtime SHALL load the declared modules without plugin dependency installation. External capability executables SHALL remain host-owned prerequisites, not installers or aliases shipped by the plugin.

#### Scenario: Load from an isolated environment

- **WHEN** OMP starts with the manager-installed release and a restricted executable path
- **THEN** plugin discovery succeeds and performs no dependency installation

#### Scenario: Optional server executable is absent

- **WHEN** a project matches Roslyn's declared root markers but `Microsoft.CodeAnalysis.LanguageServer` does not resolve
- **THEN** the personal Roslyn definition is not selected and no Roslyn startup is attempted
- **AND** the plugin does not install or substitute a language server

### Requirement: Single source for the OpenSpec workflow

The plugin SHALL be the only tracked source of the generated OpenSpec workflow adapters. A repository that consumes the workflow SHALL NOT track its own copy of a generated command or skill.

A repository MAY still define a command or skill of the same exposed name to override the plugin's, and SHALL do so only to express a repository-specific deviation. Marketplace command entry points SHALL use the stable `personal:` plugin namespace; generated skill names SHALL remain unchanged. The generator-owned files SHALL NOT be rewritten merely to rename their marketplace entry points.

Rationale: identical generated files committed into repositories with their own formatting regimes acquire two owners and diverge. The plugin manager supplies command identity without creating another generated-adapter convention.

#### Scenario: Working in any repository

- **WHEN** a session starts in a repository that uses the workflow
- **THEN** the OpenSpec commands and skills are available from the plugin
- **AND** the repository tracks no copy of them
- **AND** workflow commands are exposed as `/personal:opsx-apply`, `/personal:opsx-archive`, `/personal:opsx-explore`, `/personal:opsx-propose`, `/personal:opsx-sync`, and `/personal:opsx-update`

#### Scenario: Repository-specific override

- **WHEN** a repository defines a command or skill whose exposed name matches one the plugin provides
- **THEN** the repository's definition takes effect in that repository
- **AND** the plugin's definition remains in effect everywhere else

#### Scenario: Repository-specific capabilities are unaffected

- **WHEN** a repository defines a skill or rule that the plugin does not provide
- **THEN** it remains tracked in that repository and keeps working

### Requirement: Workflow commands register once

Each generated workflow command SHALL register exactly once under its stable `personal:` marketplace namespace. It SHALL NOT also register under a bare alias or a name derived from the installation or package location.

The manager installation SHALL deliver LSP overrides and extension modules without a second explicit plugin-root or extension load. Consumers SHALL NOT combine marketplace installation with the retired wrapper flags or copied workflow adapters.

#### Scenario: Loading the workstation configuration

- **WHEN** upstream OMP starts after user-scoped installation of `personal@glockyco`
- **THEN** each workflow command appears once in the command list under its marketplace name
- **AND** no command appears under a bare alias or a name derived from the package location

#### Scenario: LSP overrides still apply

- **WHEN** upstream OMP starts after user-scoped installation of `personal@glockyco`
- **AND** a project matches an overridden server's root markers
- **AND** that server's binary resolves
- **THEN** the override is in effect without `--plugin-dir` or a user-owned copy of the override file

### Requirement: Development payload separation

Development tools and repository tests SHALL remain outside the manager-installed runtime plugin payload.

Generated planning adapters SHALL be included in the payload, because OMP needs them at runtime: the payload is their only tracked source, and consuming repositories rely on it to provide the workflow.

The generated payload SHALL be written only by the generator. Repository formatting SHALL NOT rewrite it, so that reproducing it byte for byte remains a meaningful check.

#### Scenario: Inspect the default package

- **WHEN** a personal marketplace release is installed into a disposable OMP profile
- **THEN** its cached plugin tree contains the declared runtime plugin tree including generated workflow adapters
- **AND** excludes repository-only update automation, development tools, and repository tests

#### Scenario: Formatter runs over the repository

- **WHEN** the repository's formatter runs across tracked files
- **THEN** it does not modify the generated payload

## ADDED Requirements

### Requirement: Native marketplace delivery

The repository SHALL publish marketplace `glockyco` with plugin `personal` and runtime identity `personal@glockyco`. Its catalog SHALL identify a self-contained plugin payload, an explicit semantic release version, and an LSP configuration contained within that payload. The payload SHALL declare both runtime extension modules through its OMP package manifest.

The documented installation SHALL use `omp plugin marketplace add glockyco/omp-agent-setup` followed by `omp plugin install --scope user personal@glockyco`. The documented upgrade SHALL use `omp plugin marketplace update glockyco` followed by `omp plugin upgrade --scope user personal@glockyco`, then a fresh OMP session. Runtime publication SHALL NOT require or expose a Nix plugin package output; the independent shared OpenSpec validator SHALL remain available.

#### Scenario: Install the published personal plugin

- **WHEN** an owner follows the documented user-scoped marketplace installation in a fresh OMP profile
- **THEN** OMP lists one enabled personal marketplace release at the advertised version
- **AND** its payload resolves from the plugin manager's installed cache, not a mutable repository checkout

#### Scenario: Consume shared OpenSpec validation

- **WHEN** a Nix repository consumes `lib.openspecCheck` from this repository
- **THEN** it can continue strict and archive-completeness validation through that independently pinned interface
- **AND** runtime plugin installation does not depend on that Nix input or a default plugin package

### Requirement: Isolated complete release verification

The release gate SHALL validate the catalog and demonstrate actual install, runtime discovery, and upgrade under a temporary HOME with isolated configuration, data and cache roots. It SHALL use no provider credentials or model request, SHALL leave real OMP state unchanged, and SHALL remove its temporary profiles.

Verification SHALL observe both declared extension factories, the commit tool, all three annotation command registrations, all declared skills and their support assets, the always-applied personal policy, each workflow command exactly once, and every declared LSP override. A list or doctor result alone SHALL NOT satisfy runtime verification. Deterministic executable probes MAY prove configuration selection but SHALL NOT be reported as real language-server protocol or native-browser acceptance.

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
