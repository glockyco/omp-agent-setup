## ADDED Requirements

### Requirement: Efficient Windows release ownership queries

Windows installed-release verification SHALL query process ownership without starting a subprocess for each snapshot. It SHALL retain fresh creation-qualified PID and parent identities, fail visibly on unavailable ownership data and preserve every release scenario, coverage floor, observation deadline and cleanup assertion.

#### Scenario: Repeated ownership snapshots

- **WHEN** Windows release verification observes a native process tree repeatedly
- **THEN** the query starts no shell or process-query subprocess
- **AND** reused PIDs cannot inherit cached creation identities

#### Scenario: Ownership query fails

- **WHEN** native enumeration fails or required ownership identities are unavailable
- **THEN** verification reports failure instead of declaring the owned process tree absent
