# Spec Delta

## ADDED Requirements

### Requirement: Fresh result for an empty search

A search that finds no entry SHALL synchronize the vault and search once more before the tool reports that nothing matches. When that synchronization fails, the tool SHALL report the failure and SHALL NOT report an empty result.

#### Scenario: Entry added during the session

- **WHEN** an entry was added to the vault after the OMP process last synchronized it, and the agent searches for it
- **THEN** the tool synchronizes the vault and returns the entry
- **AND** it asks for no master password

#### Scenario: No such entry

- **WHEN** a search still finds no entry after the synchronization
- **THEN** the tool reports that nothing matches

#### Scenario: Synchronization fails after an empty search

- **WHEN** the search finds no entry and the synchronization fails
- **THEN** the tool reports the synchronization failure with its next step
- **AND** it does not say that no entry matches
