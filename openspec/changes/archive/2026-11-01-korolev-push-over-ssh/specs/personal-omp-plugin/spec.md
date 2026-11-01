## ADDED Requirements

### Requirement: Vault pushes from any session

The `notes` skill SHALL NOT require a particular kind of session for vault pushes on either machine, because Git's credentials are reachable over SSH as well.

#### Scenario: An agent works over SSH on Korolev

- **WHEN** an agent commits the vault in an SSH session on Korolev
- **THEN** the skill has it push from that session
