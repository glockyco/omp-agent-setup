## MODIFIED Requirements

### Requirement: Plain prose rule

The plugin SHALL ship an always-applied plain-prose rule, separate from the personal policy, for the prose an agent writes in documentation, comments, docstrings, notebooks, commit messages and chat. It SHALL ask for what the reader needs, in the reader's words, without filler or hedging, and SHALL exclude semicolons between clauses, typographic quotes, em and en dashes, ellipses, arrows, section signs, bold lead-ins and slogans.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the plain-prose rule beside the personal policy
- **AND** the personal policy text is unchanged

#### Scenario: Explain a setting to a player

- **WHEN** an agent writes help text for a setting in a game mod
- **THEN** the rule directs it to say what the setting does for the player in the words players use
- **AND** to leave out cases the player does not need, such as a broken weapon slot
