## MODIFIED Requirements

### Requirement: Short personal policy

The always-applied policy SHALL contain only personal deviations: required STE skill routing for technical prose, host-native interface verification, regular atomic commit checkpoints with task-owned staging and no implicit push, structured commit transport, and causal commit bodies.

The policy SHALL keep detailed writing and commit instructions in their skills instead of duplicating them globally.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy routes technical prose to the STE skill
- **AND** it requires a commit after each coherent, verified unit of multi-step work
- **AND** it permits staging only task-owned changes
- **AND** it prohibits pushing without an explicit user request
- **AND** it retains host-native interface verification, structured commit transport, and causal commit bodies without duplicating detailed skill guidance
