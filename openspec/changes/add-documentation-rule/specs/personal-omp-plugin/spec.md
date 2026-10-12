## ADDED Requirements

### Requirement: Documentation rule

The plugin SHALL ship an always-applied documentation rule, separate from the personal policy and the plain-prose rule, for repository documentation such as READMEs, guides, runbooks and agent instructions. The rule SHALL require documentation to describe the current state. It SHALL direct facts to their source, evidence and history to the change record, and longer rationale to the change's design. It SHALL require finished one-time procedures to be deleted, and plans that change documentation to name what the reader needs rather than content to copy.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule

## MODIFIED Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, mutable configuration database, or Simplified Technical English skill. The installed release SHALL contain its complete declared runtime assets without depending on the source checkout.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **THEN** every shipped always-applied rule, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance
- **AND** both declared extension modules load without import or registration errors

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the manager-installed personal plugin under a disposable profile
- **AND** no repository provides a command of the same exposed name
- **THEN** each generated workflow command is invocable under its marketplace name
- **AND** command and skill assets resolve from the installed release rather than a source checkout
