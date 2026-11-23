# Spec Delta

## MODIFIED Requirements

### Requirement: Project handoff rule

The plugin SHALL ship an always-applied handoff rule for papers, projects, supervisions, talks and topics in the notes vault. Agents SHALL link work through Workbench or find the matching note by repository URL, and read the note before work. Vault changes and commits SHALL follow the notes skill without duplicating its instructions. The rule SHALL NOT name a search mechanism for the vault.

#### Scenario: Start a repository session

- **WHEN** OMP starts with the manager-installed personal plugin in a repository without loading the notes skill
- **THEN** its system prompt contains the Project handoff rule
- **AND** the rule directs the agent to link the session through the `workbench` tool, or to search the notes vault for the repository URL without the tool, and to read the matching note before work
- **AND** Workbench returns the item's note with its `Resume here:` line, steps, waiting follow-ups and repository work
- **AND** a session started in the item's repository uses its existing link
- **AND** without the tool, the matching note is found by its `links` containing the repository URL

#### Scenario: Work moves to another item

- **WHEN** a session's work moves from one item to another
- **THEN** the rule directs the agent to link the session to the other item with the `workbench` tool

#### Scenario: The vault is reached in another way

- **WHEN** the way to search the vault changes or one route stops working
- **THEN** the rule needs no change, because it points to the notes skill for reaching the vault

### Requirement: Handoff without a matching note

Agents SHALL skip the handoff when no vault note matches the work. A search that fails or cannot run SHALL NOT count as no note.

#### Scenario: Work without a matching note

- **WHEN** no note exists for the work
- **THEN** the rule directs the agent to skip both reading and updating the handoff

#### Scenario: The search for the note fails

- **WHEN** the agent cannot search the vault, or its search returns nothing although the vault holds item notes
- **THEN** the rule directs the agent to reach the vault another way or to say that the handoff could not be read
- **AND** not to skip the handoff as if no note existed
