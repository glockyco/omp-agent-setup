## MODIFIED Requirements

### Requirement: Project handoff rule

The plugin SHALL ship an always-applied handoff rule for papers, projects, supervisions, talks and topics in the notes vault. Agents SHALL link work through Workbench or find the matching note by repository URL, and read the note before work. Before finishing, agents SHALL write a new `Resume here:` line that says where each piece of work in progress stands, in a sentence or two each, and leaves out work that is finished or not started yet and the steps, decisions, commits and checks that the note's tasks and Notes, Git and Workbench already show. Agents SHALL give every fact of the old line that the new line leaves out its place: a step tracked by an OpenSpec change or an issue stays there, any other step or a fact that calls for one becomes a task with its date when it has one, waiting becomes a `#waiting` task, a lasting decision or constraint goes under Notes with its date, and history and what Git, the repository and Workbench already show are left out. Vault changes and commits SHALL follow the notes skill without duplicating its instructions. Agents SHALL skip handoffs when no matching note exists.

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

#### Scenario: Finish work with a matching note

- **WHEN** a session finishes work on a paper, project, supervision, talk or topic with a matching vault note
- **THEN** the rule directs the agent to write a new `Resume here:` line that says where each piece of work in progress stands, in a sentence or two each, without finished work, work not started yet, or steps, decisions, commits and checks that the note, Git or Workbench already show
- **AND** to give every fact of the old line that the new line leaves out its place in a change, an issue, a task, a `#waiting` task or the Notes, or to leave it out when it is history or Git, the repository or Workbench already show it
- **AND** to follow the notes skill to change and commit the vault

#### Scenario: The old line carries another session's work

- **WHEN** the old line holds a constraint and steps that another session wrote, such as content a developer asked to keep unpublished
- **THEN** the rule directs the agent to place them as it places its own facts
- **AND** the new line mentions that work only where it is still in progress

#### Scenario: Work without a matching note

- **WHEN** no note exists for the work
- **THEN** the rule directs the agent to skip both reading and updating the handoff
