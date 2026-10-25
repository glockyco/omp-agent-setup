## MODIFIED Requirements

### Requirement: Documentation rule

The plugin SHALL ship an always-applied documentation rule, separate from the personal policy and the plain-prose rule, for repository documentation such as READMEs, guides, runbooks and agent instructions. The rule SHALL require documentation to describe the current state. It SHALL direct facts to their source, evidence and history to the change record, and longer rationale to the change's design. It SHALL require finished one-time procedures to be deleted, and plans that change documentation to name what the reader needs rather than content to copy. It SHALL require documentation for people to describe the system and address its reader without describing a person such as the owner, the user or the maintainer, and agent instructions to phrase what needs a person's decision as an instruction. It SHALL require a README to open with what the project does and for whom, then how to set it up and use it, then where to read more, and to point to specs, docs and agent instructions instead of repeating them. The rule SHALL exclude notes in the personal notes vault, which keep dates, history and decision owners under the vault's own conventions.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule

#### Scenario: Edit a vault note

- **WHEN** an agent records a reversed decision in a note of the notes vault
- **THEN** the documentation rule does not ask it to remove the date, the earlier choice or who decided

#### Scenario: Introduce a repository

- **WHEN** an agent writes the opening of a README for a plugin that serves one person's vault
- **THEN** the rule directs it to say what the plugin does and for which vault, without calling anyone the owner or the user

#### Scenario: Rewrite a README

- **WHEN** an agent rewrites a README that mixes setup with release procedures and internals
- **THEN** the rule directs it to keep what a reader needs to understand, set up and use the project, and to point to where the procedures and internals live
