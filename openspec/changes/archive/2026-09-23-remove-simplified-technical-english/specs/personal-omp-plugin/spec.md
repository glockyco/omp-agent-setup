## MODIFIED Requirements

### Requirement: Capability isolation

The plugin SHALL export no agents, model providers, local-model support, remote services, mutable configuration database, or Simplified Technical English skill.

#### Scenario: Inspect plugin discovery

- **WHEN** OMP loads only the packaged plugin under a disposable profile
- **THEN** personal policy, the remaining personal skills, the generated OpenSpec workflow skills and commands, one commit tool, and the declared LSP overrides are discoverable without personal agents, model changes, or Simplified Technical English guidance

#### Scenario: Commands resolve from the payload

- **WHEN** OMP loads only the packaged plugin under a disposable profile
- **AND** no repository provides a command of the same name
- **THEN** each generated workflow command is invocable

### Requirement: Short personal policy

The always-applied policy SHALL contain only personal deviations: host-native interface verification, regular atomic commit checkpoints with task-owned staging and no implicit push, structured commit transport, and causal commit bodies. It SHALL NOT route writing tasks to Simplified Technical English.

The policy SHALL keep detailed commit instructions in their skill instead of duplicating them globally.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy does not route technical or scientific writing to an STE skill
- **AND** it requires a commit after each coherent, verified unit of multi-step work
- **AND** it permits staging only task-owned changes
- **AND** it prohibits pushing without an explicit user request
- **AND** it retains host-native interface verification, structured commit transport, and causal commit bodies without duplicating detailed skill guidance
