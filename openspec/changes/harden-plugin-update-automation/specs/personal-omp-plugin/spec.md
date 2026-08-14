## ADDED Requirements

### Requirement: Generated adapter freshness

The repository SHALL verify that its tracked OpenSpec commands and skills match the locked OpenSpec generator. An OpenSpec update SHALL fail the release gate until generated changes are reviewed and committed.

#### Scenario: OpenSpec changes generated instructions

- **WHEN** the locked OpenSpec package would rewrite a tracked command or skill
- **THEN** the release gate fails and identifies the generated adapter drift

### Requirement: Archived change completeness

The repository SHALL reject an archived OpenSpec change that contains an incomplete task. Strict validation SHALL also retain scenario and task-numbering checks for active contracts.

#### Scenario: An incomplete change is archived

- **WHEN** an archived change contains an unchecked task
- **THEN** the plugin release gate fails

### Requirement: Development payload separation

Development tools, generated planning adapters, and repository tests SHALL remain outside the default immutable plugin payload unless OMP needs them at runtime.

#### Scenario: Inspect the default package

- **WHEN** a supported system builds the default plugin package
- **THEN** the output contains the declared runtime plugin tree and excludes repository-only update automation
