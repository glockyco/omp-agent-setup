## MODIFIED Requirements

### Requirement: Project handoff rule

The plugin SHALL ship an always-applied project handoff rule for work on an item of the notes vault: a paper, project, supervision, talk or topic. The rule SHALL direct agents to link the session to the item with the Workbench `workbench` tool, which returns the item's note and `Resume here:` line, to rely on the link that a session started in an item's repository already has, and to link again when the work moves to another item. Without the tool, agents SHALL find the note whose `links` contain the repository URL by searching the notes vault and read its `Resume here:` line before starting. Before finishing, agents SHALL rewrite the handoff with the current state and next step so a session with no other context can continue, and SHALL add or update dated tasks for steps with a date. The rule SHALL delegate vault changes and commits to the notes skill instead of duplicating that skill's handoff instruction. Agents SHALL skip reading and updating a handoff when no matching note exists.

#### Scenario: Start a repository session

- **WHEN** OMP starts with the manager-installed personal plugin in a repository without loading the notes skill
- **THEN** its system prompt contains the Project handoff rule
- **AND** the rule directs the agent to link the session through the `workbench` tool, or to search the notes vault for the repository URL without the tool, and to read the matching note's handoff before work

#### Scenario: Work moves to another item

- **WHEN** a session's work moves from one item to another
- **THEN** the rule directs the agent to link the session to the other item with the `workbench` tool

#### Scenario: Finish work with a matching note

- **WHEN** a session finishes work on a paper, project, supervision, talk or topic with a matching vault note
- **THEN** the rule directs the agent to replace the handoff with the current state and next step, update dated tasks for dated steps, and follow the notes skill to change and commit the vault

#### Scenario: Work without a matching note

- **WHEN** no note exists for the work
- **THEN** the rule directs the agent to skip both reading and updating the handoff
