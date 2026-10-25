## MODIFIED Requirements

### Requirement: Short personal policy

The always-applied policy SHALL contain only personal deviations: host-native interface verification, regular atomic commit checkpoints with task-owned staging and no implicit push, structured commit transport, causal commit bodies, and durable storage for work that should outlive a session. It SHALL NOT route writing tasks to Simplified Technical English.

The policy SHALL keep detailed commit instructions in their skill instead of duplicating them globally.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy does not route technical or scientific writing to an STE skill
- **AND** it requires a commit after each coherent, verified unit of multi-step work
- **AND** it permits staging only task-owned changes
- **AND** it prohibits pushing without an explicit user request
- **AND** it retains host-native interface verification, structured commit transport, and causal commit bodies without duplicating detailed skill guidance

#### Scenario: Preserve lasting work

- **WHEN** a fresh session loads the manager-installed personal plugin
- **THEN** its personal policy directs work that should outlive the session into its repository, the notes vault or a synced documents folder
- **AND** it forbids storing that work in temporary directories because the system deletes files there
