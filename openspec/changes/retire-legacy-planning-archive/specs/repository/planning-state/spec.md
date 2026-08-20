## Purpose

Defines the repository's planning authority and prevents retired mutable-deployment instructions from returning as current or browsable guidance.

## ADDED Requirements

### Requirement: OpenSpec is the sole tracked planning authority

The repository SHALL keep current change plans under `openspec/changes/` and accepted behavior under `openspec/specs/`. Current guidance SHALL NOT direct readers to another planning directory.

#### Scenario: A reader locates current work

- **WHEN** a reader follows repository guidance to find current work
- **THEN** the guidance names `openspec/changes/`
- **AND** it does not name `docs/plans/` as a current or historical planning source

### Requirement: Legacy records are removed only after disposition

The repository SHALL assign each legacy planning record one verified disposition before removal. A unique current requirement or technical fact SHALL move to its accepted spec or current subject document. Completed, superseded, duplicated, or retired workflow content SHALL remain available only through Git history.

#### Scenario: A record contains a current requirement

- **WHEN** a legacy record contains a requirement that current behavior still depends on
- **THEN** the complete requirement exists in one accepted capability spec before removal
- **AND** the legacy record is not retained as a second authority

#### Scenario: A record contains only retired workflow

- **WHEN** a legacy record describes `omp-plans`, `planning-files`, mutable deployment, or completed implementation history with no current owner
- **THEN** the tracked record is removed
- **AND** no replacement archive is created

### Requirement: Current policy excludes the retired convention

Current guidance, skills, rules, source documentation, and packaged plugin content SHALL NOT instruct a reader to use `omp-plans`, `planning-files`, or `docs/plans/`. Historical command names MAY appear in archived OpenSpec changes or explicit removal requirements.

#### Scenario: Retired guidance returns to a current surface

- **WHEN** a current policy or documentation surface instructs use of the retired convention
- **THEN** repository validation fails with the conflicting path

#### Scenario: An accepted removal requirement names the command

- **WHEN** an accepted spec names `omp-plans` only to prohibit or verify its removal
- **THEN** repository validation permits that historical reference

### Requirement: Repository validation guards the sole home

The normal repository validation path SHALL reject a restored `docs/plans/` tree, a current retired-convention instruction, or guidance that declares a second planning home. The detector SHALL prove its reach with a known conflicting fixture.

#### Scenario: The retired archive is restored

- **WHEN** a change adds a tracked file below `docs/plans/`
- **THEN** repository validation fails and reports the path

#### Scenario: The repository follows the contract

- **WHEN** current planning remains under `openspec/` and current policy omits the retired convention
- **THEN** repository validation passes
