# Spec Delta

## MODIFIED Requirements

### Requirement: Handoff line and the places of its facts

Before finishing, agents SHALL rewrite the item's `Resume here:` line and put each fact it leaves out where `Conventions.md` says under Item notes. The handoff rule SHALL describe the line as how to pick the work up without duplicating the vault's rules for its content or the placement of facts.

#### Scenario: Finish work with a matching note

- **WHEN** a session finishes work on a paper, project, supervision, talk or topic with a matching vault note
- **THEN** the rule directs the agent to rewrite the item's `Resume here:` line and put each fact it leaves out where `Conventions.md` says under Item notes
- **AND** to follow the notes skill to change and commit the vault

#### Scenario: The old line carries another session's work

- **WHEN** the old line holds facts that another session wrote
- **THEN** the rule directs the agent to put each fact it leaves out where `Conventions.md` says under Item notes

#### Scenario: The vault changes its item note conventions

- **WHEN** `Conventions.md` changes how an item note resumes work or places facts
- **THEN** the handoff rule directs the agent to those conventions without retaining a competing copy

### Requirement: Notes hold current decisions

The `notes` skill SHALL direct agents to write notes as `Conventions.md` says rather than duplicate its rules for dates, decision makers or editing.

#### Scenario: A decision recorded in an item's Notes changes

- **WHEN** an agent records a changed decision in an item's Notes
- **THEN** the skill directs it to follow `Conventions.md`

### Requirement: Current vault decisions

The documentation rule SHALL distinguish vault notes from repository documentation and say that the vault's `Conventions.md` governs them. The `notes` skill SHALL direct agents to propose convention changes in Plannotator and make them only once approved, never as a side effect of other work. It SHALL retain the instruction to describe a plugin's behavior in its README.

#### Scenario: Correct an outdated note

- **WHEN** an agent corrects an outdated note
- **THEN** the notes skill directs it to follow `Conventions.md` rather than a separate plugin rule for note content

#### Scenario: Change a vault convention

- **WHEN** an agent needs to change `Conventions.md`
- **THEN** the skill requires a proposal in Plannotator and approval before the change
- **AND** it prohibits making the convention change as a side effect of other work

#### Scenario: Describe plugin behavior

- **WHEN** an agent documents a plugin's behavior
- **THEN** the notes skill directs it to the plugin's README
