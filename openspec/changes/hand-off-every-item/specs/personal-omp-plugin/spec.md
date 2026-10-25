## MODIFIED Requirements

### Requirement: Project handoff rule

The plugin SHALL ship an always-applied project handoff rule for work on an item of the notes vault: a paper, project, supervision, talk or topic. The rule SHALL direct agents to find the work's note in the notes vault and read its `Resume here:` line before starting. For repository work, the matching note SHALL be found by searching for the repository URL contained in its `links`. Before finishing, agents SHALL rewrite the handoff with the current state and next step so a session with no other context can continue, and SHALL add or update dated tasks for steps with a date. The rule SHALL delegate vault changes and commits to the notes skill instead of duplicating that skill's handoff instruction. Agents SHALL skip reading and updating a handoff when no matching note exists.

#### Scenario: Start a repository session

- **WHEN** OMP starts with the manager-installed personal plugin in a repository without loading the notes skill
- **THEN** its system prompt contains the Project handoff rule
- **AND** the rule directs the agent to search the notes vault for the repository URL and read the matching note's handoff before work

#### Scenario: Finish work with a matching note

- **WHEN** a session finishes work on a paper, project, supervision, talk or topic with a matching vault note
- **THEN** the rule directs the agent to replace the handoff with the current state and next step, update dated tasks for dated steps, and follow the notes skill to change and commit the vault

#### Scenario: Work without a matching note

- **WHEN** no note exists for the work
- **THEN** the rule directs the agent to skip both reading and updating the handoff
