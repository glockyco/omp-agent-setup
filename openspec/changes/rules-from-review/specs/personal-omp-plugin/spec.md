## ADDED Requirements

### Requirement: Questions in Plannotator

The personal policy SHALL have agents ask for decisions, approvals and answers in Plannotator, as question cards with a marked recommendation in a Markdown file opened with the `plannotator` tool. It SHALL allow chat only when Plannotator cannot open, naming the file.

#### Scenario: A decision comes up during work

- **WHEN** an agent needs the person's decision
- **THEN** the personal policy directs it to write the question as a question card with a marked recommendation and open the file in Plannotator

### Requirement: Checks after a push

The personal policy SHALL have agents wait for the checks of a push and fix or report a failure.

#### Scenario: A pushed branch fails its checks

- **WHEN** an agent has pushed and a check fails
- **THEN** the personal policy directs it to fix the failure or report it

## MODIFIED Requirements

### Requirement: Compare options rule

The plugin SHALL ship an always-applied rule that sends text players see and visible design choices in game projects through the `compare-options` skill before they ship, including posts about the games, such as Ko-fi gallery items, and text written inside other work or by subagents.

#### Scenario: Load the rule

- **WHEN** OMP starts a session or a subagent with the manager-installed personal plugin in any working directory
- **THEN** the system prompt carries the compare-options rule

#### Scenario: Write a gallery item

- **WHEN** an agent drafts the title and description of a Ko-fi gallery item about a game project
- **THEN** the rule directs it to the `compare-options` skill before the item is posted

### Requirement: Short personal policy

The always-applied policy SHALL contain only personal deviations: host-native interface verification, regular atomic commit checkpoints with task-owned staging and no implicit push, checks after a push, questions in Plannotator, structured commit transport, causal commit bodies, and durable storage for work that should outlive a session. It SHALL NOT route writing tasks to Simplified Technical English.

The policy SHALL keep detailed commit instructions in their skill instead of duplicating them globally.

#### Scenario: Read global policy

- **WHEN** OMP loads the plugin rules
- **THEN** the personal policy does not route technical or scientific writing to an STE skill
- **AND** it requires a commit after each coherent, verified unit of multi-step work
- **AND** it permits staging only task-owned changes
- **AND** it prohibits pushing without an explicit user request
- **AND** it retains host-native interface verification, structured commit transport, and causal commit bodies without duplicating detailed skill guidance

#### Scenario: Preserve lasting work

- **WHEN** a fresh session loads the manager-installed personal plugin
- **THEN** its personal policy directs work that should outlive the session into its repository, the notes vault or a synced documents folder
- **AND** it forbids storing that work in temporary directories because the system deletes files there
