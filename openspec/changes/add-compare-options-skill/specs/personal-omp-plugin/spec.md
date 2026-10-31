## ADDED Requirements

### Requirement: Compare options skill

The plugin SHALL ship a `compare-options` skill for deciding text that players see and visible design choices in game projects. The skill SHALL have a person choose from two to four options that differ in structure, drawn from how strong references handle the same situation, beside the current version and a way to reject all of them, with one option marked as recommended and its reason. Options SHALL state game behaviour only as observed in the running game.

#### Scenario: Discover the skill

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `compare-options` skill is discoverable

#### Scenario: Word text inside other work

- **WHEN** an agent writes the player-facing text of a known game issue while fixing a data error
- **THEN** the skill directs it to present options with a marked recommendation to a person in Plannotator before the text ships

### Requirement: Comparison cases in the notes vault

The `compare-options` skill SHALL have the agent record each decision as a case in the notes of the vault item the decision belongs to, and read earlier cases from any project before the next decision. Cases, specs and agent-written designs SHALL count as evidence, not authority, and what the agent infers from an answer SHALL stay labelled as inferred.

#### Scenario: Record a decision

- **WHEN** a person answers a comparison
- **THEN** the skill directs the agent to record the question, the options with a link to the comparison, the person's words verbatim, the outcome and the date in the notes of the vault item the decision belongs to

#### Scenario: Prepare the next decision

- **WHEN** an agent prepares a new comparison
- **THEN** the skill directs it to search the vault for earlier cases, also from other projects, and to say what transfers and what does not

### Requirement: Subagents draft comparisons

A subagent that drafts text players see or a visible design choice SHALL receive the path of the `compare-options` skill and SHALL return options without committing, pushing or deploying them.

#### Scenario: Delegate drafting

- **WHEN** an agent hands the drafting of player-facing text to a subagent
- **THEN** the skill directs it to give the subagent the skill's path
- **AND** the subagent returns options and does not commit, push or deploy them

### Requirement: Compare options rule

The plugin SHALL ship an always-applied rule that sends text players see and visible design choices in game projects through the `compare-options` skill before they ship, including text written inside other work or by subagents.

#### Scenario: Load the rule

- **WHEN** OMP starts a session or a subagent with the manager-installed personal plugin in any working directory
- **THEN** the system prompt carries the compare-options rule

## MODIFIED Requirements

### Requirement: Plain prose rule

The plugin SHALL ship an always-applied plain-prose rule, separate from the personal policy, for the prose an agent writes in documentation, comments, docstrings, notebooks, commit messages and chat. The rule SHALL ask for factual sentences without filler or hedging and SHALL exclude semicolons between clauses, typographic quotes and apostrophes, em and en dashes, ellipsis characters, arrows, section signs, bold bullet lead-ins and slogans.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the plain-prose rule beside the personal policy
- **AND** the personal policy text is unchanged
