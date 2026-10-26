# repository/planning-state Specification

## Purpose
Defines the repository's planning authority and prevents retired mutable-deployment instructions from returning as current or browsable guidance.

## Requirements

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

#### Scenario: A current surface is maintained

- **WHEN** current guidance or packaged content is revised
- **THEN** its instructions use OpenSpec rather than the retired convention
- **AND** review checks this contract without a documentation-vocabulary test

#### Scenario: An accepted removal requirement names the command

- **WHEN** an accepted spec names `omp-plans` only to prohibit or record its removal
- **THEN** that historical reference does not instruct operational use
