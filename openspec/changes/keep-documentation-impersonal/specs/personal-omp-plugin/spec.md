## MODIFIED Requirements

### Requirement: Documentation rule

The plugin SHALL ship an always-applied documentation rule, separate from the personal policy and the plain-prose rule, for repository documentation such as READMEs, guides, runbooks and agent instructions. The rule SHALL require documentation to describe the current state. It SHALL direct facts to their source, evidence and history to the change record, and longer rationale to the change's design. It SHALL require finished one-time procedures to be deleted, and plans that change documentation to name what the reader needs rather than content to copy. It SHALL require documentation for people to describe the system and address its reader without describing a person such as the owner, the user or the maintainer, and agent instructions to phrase what needs a person's decision as an instruction. The rule SHALL exclude notes in the personal notes vault, which keep dates, history and decision owners under the vault's own conventions.

#### Scenario: Load the rule

- **WHEN** OMP starts with the manager-installed personal plugin
- **THEN** the system prompt carries the documentation rule beside the personal policy and the plain-prose rule

#### Scenario: Edit a vault note

- **WHEN** an agent records a reversed decision in a note of the notes vault
- **THEN** the documentation rule does not ask it to remove the date, the earlier choice or who decided

#### Scenario: Introduce a repository

- **WHEN** an agent writes the opening of a README for a plugin that serves one person's vault
- **THEN** the rule directs it to say what the plugin does and for which vault, without calling anyone the owner or the user

### Requirement: Notes vault skills

The plugin SHALL ship a `notes` skill and a `weekly-review` skill for the personal Obsidian vault `notes`. The `notes` skill SHALL direct agents to the vault's conventions note before they change the vault, and SHALL state how to reach, change and commit the vault from any working directory. The `weekly-review` skill SHALL direct agents to the vault's review checklist note. Neither skill SHALL restate the conventions or the checklist.

#### Scenario: Discover the skills

- **WHEN** OMP starts with the manager-installed personal plugin in any working directory
- **THEN** the `notes` and `weekly-review` skills are discoverable

#### Scenario: Change a convention

- **WHEN** a convention changes in the vault's conventions note
- **THEN** agents follow the changed convention without a plugin release

### Requirement: Native marketplace delivery

The repository SHALL publish marketplace `glockyco` with plugin `personal` and runtime identity `personal@glockyco`. Its catalog SHALL identify a self-contained plugin payload, an explicit semantic release version, and an LSP configuration contained within that payload. The payload SHALL declare both runtime extension modules through its OMP package manifest.

The documented installation SHALL use `omp plugin marketplace add glockyco/omp-agent-setup` followed by `omp plugin install --scope user personal@glockyco`. The documented upgrade SHALL use `omp plugin marketplace update glockyco` followed by `omp plugin upgrade --scope user personal@glockyco`, then a fresh OMP session. Runtime publication SHALL NOT require or expose a Nix plugin package output; the independent shared OpenSpec validator SHALL remain available.

#### Scenario: Install the published personal plugin

- **WHEN** the documented user-scoped marketplace installation runs in a fresh OMP profile
- **THEN** OMP lists one enabled personal marketplace release at the advertised version
- **AND** its payload resolves from the plugin manager's installed cache, not a mutable repository checkout

#### Scenario: Consume shared OpenSpec validation

- **WHEN** a Nix repository consumes `lib.openspecCheck` from this repository
- **THEN** it can continue strict and archive-completeness validation through that independently pinned interface
- **AND** runtime plugin installation does not depend on that Nix input or a default plugin package
