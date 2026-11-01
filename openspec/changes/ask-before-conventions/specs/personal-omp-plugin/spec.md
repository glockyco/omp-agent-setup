## ADDED Requirements

### Requirement: Approved changes to the conventions note

The `notes` skill SHALL have agents propose a change to the vault's conventions note in Plannotator and make it only once approved, never as a side effect of other work. It SHALL have them describe a plugin's behavior in the plugin's README.

#### Scenario: A plugin upgrade suggests a convention

- **WHEN** an agent upgrading a plugin finds behavior it would describe in the conventions note
- **THEN** the skill directs it to describe the behavior in the plugin's README
- **AND** to propose any change to the conventions note in Plannotator before making it
