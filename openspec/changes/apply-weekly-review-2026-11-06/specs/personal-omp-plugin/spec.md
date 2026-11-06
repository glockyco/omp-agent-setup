# Spec Delta

## ADDED Requirements

### Requirement: One topic per announcement

The `compare-options` skill SHALL have the agent keep one topic in one post, with several images when needed and its link once, because readers should not piece one announcement together from several.

#### Scenario: Announce one topic with several images

- **WHEN** an agent prepares one announcement that needs several images and a link
- **THEN** the skill directs it to keep the topic and images in one post with the link once

### Requirement: Current vault decisions

The `notes` skill SHALL distinguish vault notes from repository documentation, retain each decision's date and decision maker under `Conventions.md`, and fix wrong or outdated notes in place so they state what holds now. Git SHALL keep their previous content rather than a change log in Notes.

#### Scenario: Correct an outdated note

- **WHEN** an agent corrects a reversed decision
- **THEN** the note states the current decision with its date and decision maker without retaining contradictory previous rules

### Requirement: Preserve open todos

The personal policy SHALL direct agents to add requests or side tasks with `todo append` and update, finish or drop existing todos one by one. Agents SHALL use `todo init` only when no todo is open or after carrying every open todo into the replacement list.

#### Scenario: A request arrives during open work

- **WHEN** an agent receives a side task while todos remain open
- **THEN** the policy directs it to append that task without replacing the open list

#### Scenario: Replace a todo list

- **WHEN** an agent initializes a replacement list with open todos
- **THEN** every open todo is carried into the new list

## MODIFIED Requirements

### Requirement: Vault commits from either machine

The `notes` skill SHALL have agents commit all pending vault changes, not only their own, on whichever machine they work, after a pull with rebase, and push right away. It SHALL have them leave out files that another session or Obsidian changed in the last 15 minutes, because they may still be editing them. It SHALL have agents commit their own finished edits right away.

#### Scenario: Another session left changes

- **WHEN** an agent commits the vault while another session's edit from an hour ago is pending
- **THEN** the commit includes that edit

#### Scenario: A file is still in work

- **WHEN** another session or Obsidian changed a pending file five minutes ago
- **THEN** the agent leaves it out of the commit

#### Scenario: The current session finished its edit

- **WHEN** an agent finishes its own vault edit less than 15 minutes ago and no other session or Obsidian changed that file in the last 15 minutes
- **THEN** the skill directs it to commit that finished edit right away


### Requirement: Documentation rule

The plugin SHALL ship a separate always-applied rule for repository documentation, including READMEs, guides, runbooks and agent instructions. Documentation SHALL describe the current state, refer facts to their source and keep evidence, history and longer rationale in change records. Finished one-time procedures SHALL be deleted. Plans changing documentation SHALL name reader needs rather than content to copy.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule
- **AND** documentation for people describes the system and addresses its reader without describing a person such as the owner, user or maintainer
- **AND** agent instructions phrase what needs a person's decision as an instruction
- **AND** a README opens with what the project does and for whom, then setup and use, then further reading
- **AND** the README points to specs, docs and agent instructions instead of repeating them
- **AND** notes in the personal notes vault retain dates and decision owners under the vault's own conventions

#### Scenario: Edit a vault note

- **WHEN** an agent records a reversed decision in a note of the notes vault
- **THEN** the documentation rule retains the decision date and who decided without requiring the earlier choice

#### Scenario: Introduce a repository

- **WHEN** an agent writes the opening of a README for a plugin that serves one person's vault
- **THEN** the rule directs it to say what the plugin does and for which vault, without calling anyone the owner or the user

#### Scenario: Rewrite a README

- **WHEN** an agent rewrites a README that mixes setup with release procedures and internals
- **THEN** the rule directs it to keep what a reader needs to understand, set up and use the project, and to point to where the procedures and internals live

### Requirement: Earlier decisions as evidence

The `compare-options` skill SHALL have the agent read earlier decisions from any project before drafting each decision. Decisions, specs and agent-written designs SHALL count as evidence that can be wrong or out of date.

#### Scenario: Prepare the next decision

- **WHEN** an agent prepares a new comparison
- **THEN** the skill directs it to search the project's specs and the notes vault for earlier decisions, also from other projects, and to say what transfers and what does not

### Requirement: Comparison decisions in the notes vault

The `compare-options` skill SHALL record current decisions in the repository's OpenSpec specs or active change, otherwise in the vault item's Notes. Records SHALL contain one exact example, scope and a one-sentence reason when needed, replacing the same subject without options, comparison history or inferences. Further questions SHALL use a new Plannotator comparison, not chat.

#### Scenario: Record a decision

- **WHEN** a person answers a comparison for a project with a repository
- **THEN** the skill directs the agent to record the current rule in that repository's OpenSpec specs or active change with one exact example, its scope and a one-sentence reason when needed
- **AND** the comparison need not quote the person's words

#### Scenario: Record a decision without a repository

- **WHEN** the project has no repository
- **THEN** the decision belongs under the Notes of its vault item

#### Scenario: An answer changes an earlier decision

- **WHEN** an answer changes a subject that an earlier record covers
- **THEN** the skill directs the agent to replace that record without options, comparison history or inferences

#### Scenario: Applying an answer raises a question

- **WHEN** a fact changes the approved option while applying an answer
- **THEN** the skill directs the agent to ask a new comparison in Plannotator rather than chat
