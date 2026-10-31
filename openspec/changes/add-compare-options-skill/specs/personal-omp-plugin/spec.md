## ADDED Requirements

### Requirement: Compare options skill

The plugin SHALL ship a `compare-options` skill for deciding text that players see and visible design choices in game projects. The skill SHALL have the agent draft two to four options that differ in structure, drawn from how strong references handle the same situation, and ask which one to ship beside the current version and a way to reject all of them, with one option marked as recommended and its reason. Options SHALL state game behaviour only as observed in the running game.

#### Scenario: Discover the skill

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `compare-options` skill is discoverable

#### Scenario: Word text inside other work

- **WHEN** an agent writes the player-facing text of a known game issue while fixing a data error
- **THEN** the skill directs it to present options with a marked recommendation in Plannotator before the text ships

### Requirement: Checked recommendations

The `compare-options` skill SHALL have the agent check every option against the project's written reader-text rules and the wording earlier answers approved, say in the comparison which rule or approved wording an option breaks and which one decides between options, and recommend the option it judges best with a reason that is true of the option.

#### Scenario: Recommend a heading

- **WHEN** an agent recommends one of several headings for a known issue and earlier answers approved headings of one pattern
- **THEN** the comparison says which headings break that pattern

### Requirement: Elements the reader needs

The `compare-options` skill SHALL have the agent ask of every element and sentence in the options whether the reader needs it on that page and what they can do with it, and offer an option without an element the reader may not need.

#### Scenario: Question an added element

- **WHEN** a comparison covers an element that an agent or a model reviewer added, such as a line in a link preview
- **THEN** the options include leaving it out

### Requirement: Open decisions named in chat

The `compare-options` skill SHALL have the agent name the open decision, its options and the recommendation in chat beside the comparison's link.

#### Scenario: Wait for an answer

- **WHEN** a comparison is open for a person
- **THEN** the agent's message names the decision, the options and the recommendation besides the link

### Requirement: References written by people

The `compare-options` skill SHALL have the agent model wording on text that people wrote, such as large game wikis, look at how the game itself shows a thing for a visible design choice, take only structure from other game projects whose text agents wrote, and show only references that answer the decision's question.

#### Scenario: Draft a page another project has

- **WHEN** an agent drafts a site's About page and another game project in the vault has one
- **THEN** the skill directs it to take that page's structure and to model the wording on pages that people wrote

### Requirement: Options shown in place

The `compare-options` skill SHALL have the agent keep a comparison to what its decision needs, show each option in place with screenshots of the real page at the same widths, and look at every screenshot for layout defects before showing it.

#### Scenario: Stray line break

- **WHEN** a screenshot shows a line that wraps although the layout has room for it
- **THEN** the skill directs the agent to fix or point out the break before it opens the comparison

### Requirement: Comparison cases in the notes vault

The `compare-options` skill SHALL have the agent record each decision as a case in the notes of the vault item the decision belongs to, and read earlier cases from any project before drafting each decision. Cases, specs and agent-written designs SHALL count as evidence that can be wrong or out of date, and what the agent infers from an answer SHALL stay labelled as inferred.

#### Scenario: Record a decision

- **WHEN** a person answers a comparison
- **THEN** the skill directs the agent to record the question, the options with a link to the comparison, the answer verbatim, the outcome and the date in the notes of the vault item the decision belongs to

#### Scenario: Prepare the next decision

- **WHEN** an agent prepares a new comparison
- **THEN** the skill directs it to search the vault for earlier cases, also from other projects, and to say what transfers and what does not

### Requirement: Rounds after a rejection

The `compare-options` skill SHALL have the agent, when an answer rejects its options, change what the answer names, look for the same problem elsewhere on the page, and keep what earlier answers approved unless the new answer changes it.

#### Scenario: One sentence rejected

- **WHEN** an answer calls one sentence of the recommended option irrelevant
- **THEN** the next round leaves that sentence out, asks the same of the page's other sentences and keeps the parts that earlier answers approved

### Requirement: Subagents return options

A subagent whose work includes text players see or a visible design choice SHALL receive the path of the `compare-options` skill and SHALL return that text as options without committing, pushing or deploying it.

#### Scenario: Delegate work that includes player-facing text

- **WHEN** an agent hands a subagent work that includes player-facing text
- **THEN** the skill directs it to give the subagent the skill's path
- **AND** the subagent returns the text as options and does not commit, push or deploy it

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
