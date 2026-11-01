## ADDED Requirements

### Requirement: Work named instead of task numbers

The commit policy SHALL have a commit message name the work it does, not its task number in a plan, because task numbers repeat across changes and plans get renumbered.

#### Scenario: Commit work that finishes a planned task

- **WHEN** the agent commits work that completes task 2.3 of an OpenSpec change
- **THEN** the message describes the work
- **AND** it does not cite "task 2.3"
