## ADDED Requirements

### Requirement: Notes hold current decisions

The `notes` skill SHALL say that vault notes keep dates and who decided what, as the vault's conventions note describes for Notes. It SHALL NOT say that Notes sections keep history.

#### Scenario: A decision recorded in an item's Notes changes

- **WHEN** an agent records a changed decision in an item's Notes
- **THEN** the skill directs it to the conventions note's form for Notes instead of to a history of entries
