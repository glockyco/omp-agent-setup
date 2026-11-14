## ADDED Requirements

### Requirement: Truthful transferred task records

The always-applied personal policy SHALL require recording a transfer and its destination in `tasks.md` before archiving an OpenSpec change whose remaining tasks moved to another change or repository. It SHALL require converting transferred tasks to plain bullets rather than leaving unchecked tasks or marking unperformed work complete.

#### Scenario: Archive transferred work

- **WHEN** remaining tasks moved to another change or repository
- **THEN** the personal policy directs the agent to record the transfer and destination in `tasks.md` before archiving
- **AND** transferred tasks become plain bullets without claiming completion

#### Scenario: Observe installed archive guidance

- **WHEN** a fresh OMP session loads the manager-installed personal plugin
- **THEN** the system prompt includes the transfer-record and plain-bullet instruction
- **AND** the installed-release gate rejects a candidate that omits this instruction while retaining the rest of the personal policy
