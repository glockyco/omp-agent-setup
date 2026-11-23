# Spec Delta

## ADDED Requirements

### Requirement: Checks in a fresh Tern session

The always-applied personal policy SHALL forbid telling the person to restart OMP or to open a terminal in order to check something. It SHALL direct the agent to start a fresh session through Tern, observe the result there and end that session.

#### Scenario: A check needs a new environment

- **WHEN** a session must confirm something that only a newly started session shows, such as a host variable set after it started
- **THEN** the policy directs the agent to start a Tern session, observe the result and end the session
- **AND** not to ask the person for a restart
