## ADDED Requirements

### Requirement: Efficient Windows release ownership queries

Windows installed-release verification SHALL query process ownership without starting a subprocess for each snapshot. It SHALL retain fresh creation-qualified PID and parent identities, fail visibly on unavailable ownership data and preserve every release scenario, coverage floor, observation deadline and cleanup assertion. Successful force requests SHALL wait boundedly for observed exit, still rejecting survivors and query failures.

#### Scenario: Repeated ownership snapshots

- **WHEN** Windows release verification observes a native process tree repeatedly
- **THEN** the query starts no shell or process-query subprocess
- **AND** reused PIDs cannot inherit cached creation identities

#### Scenario: Ownership query fails

- **WHEN** native enumeration fails or required ownership identities are unavailable
- **THEN** verification reports failure instead of declaring the owned process tree absent

#### Scenario: Force termination completes asynchronously

- **WHEN** a successful force request returns before the owned process disappears
- **THEN** cleanup waits boundedly for observed exit rather than assuming the request completed it
- **AND** a survivor or failed process query still fails verification
