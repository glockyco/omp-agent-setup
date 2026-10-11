## ADDED Requirements

### Requirement: Plain prose rule

The plugin SHALL ship an always-applied plain-prose rule, separate from the personal policy, for the prose an agent writes in documentation, comments, docstrings, notebooks, commit messages and chat. The rule SHALL ask for short factual sentences and SHALL exclude semicolons between clauses, typographic quotes and apostrophes, em and en dashes, ellipsis characters, arrows, section signs, bold bullet lead-ins and slogans.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the plain-prose rule beside the personal policy
- **AND** the personal policy text is unchanged

### Requirement: Prose rule exemptions

The plain-prose rule SHALL leave the punctuation of code, grammars, quotations, and manuscripts such as papers and theses unchanged. It SHALL NOT route writing to a skill or prescribe a controlled language.

#### Scenario: Read the exemptions

- **WHEN** OMP loads the plugin rules
- **THEN** the plain-prose rule names code, grammars, quotations and manuscripts as exempt
- **AND** it routes no writing task to a skill

## MODIFIED Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, mutable configuration database, or Simplified Technical English skill. The installed release SHALL contain its complete declared runtime assets without depending on the source checkout.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **THEN** personal policy, the plain-prose rule, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance
- **AND** both declared extension modules load without import or registration errors

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **AND** no repository provides a command of the same exposed name
- **THEN** each generated workflow command is invocable under its marketplace name
- **AND** command and skill assets resolve from the installed release rather than a source checkout

### Requirement: Isolated complete release verification

The release gate SHALL validate the catalog and demonstrate actual install, runtime discovery, and upgrade under a temporary HOME with isolated configuration, data and cache roots. It SHALL use no provider credentials or model request, SHALL leave real OMP state unchanged, and SHALL remove its temporary profiles.

Verification SHALL observe both declared extension factories, the commit tool, all three annotation command registrations, all declared skills and their support assets, every always-applied rule, each workflow command exactly once, and every declared LSP override. A list or doctor result alone SHALL NOT satisfy runtime verification. Deterministic executable probes MAY prove configuration selection but SHALL NOT be reported as real language-server protocol or native-browser acceptance.

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
