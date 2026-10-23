## ADDED Requirements

### Requirement: Notes vault skills

The plugin SHALL ship a `notes` skill and a `weekly-review` skill for the personal Obsidian vault `notes`. The `notes` skill SHALL direct agents to the vault's conventions note before they change the vault, and SHALL state how to reach, change and commit the vault from any working directory. The `weekly-review` skill SHALL direct agents to the vault's review checklist note. Neither skill SHALL restate the conventions or the checklist.

#### Scenario: Discover the skills

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `notes` and `weekly-review` skills are discoverable

#### Scenario: Change a convention

- **WHEN** the owner changes a convention in the vault's conventions note
- **THEN** agents follow the changed convention without a plugin release

## MODIFIED Requirements

### Requirement: Documentation rule

The plugin SHALL ship an always-applied documentation rule, separate from the personal policy and the plain-prose rule, for repository documentation such as READMEs, guides, runbooks and agent instructions. The rule SHALL require documentation to describe the current state. It SHALL direct facts to their source, evidence and history to the change record, and longer rationale to the change's design. It SHALL require finished one-time procedures to be deleted, and plans that change documentation to name what the reader needs rather than content to copy. The rule SHALL exclude notes in the personal notes vault, which keep dates, history and decision owners under the vault's own conventions.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule

#### Scenario: Edit a vault note

- **WHEN** an agent records a reversed decision in a note of the notes vault
- **THEN** the documentation rule does not ask it to remove the date, the earlier choice or who decided
