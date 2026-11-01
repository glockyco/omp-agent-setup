# repository/ci-path-classification Specification

## Purpose
Select native repository CI conservatively while preserving required contexts and independent OpenSpec artifact validation.

## Requirements

### Requirement: Conservative native selection

CI SHALL skip all three native gates only for pull requests whose complete diff changes exclusively paths under `openspec/` or files ending in `.md` or `.markdown`. All other paths and non-PR events SHALL run every native gate. Classification SHALL include deletions and both sides of renames.

#### Scenario: Documentation and contracts only

- **WHEN** a PR changes only Markdown files and OpenSpec artifacts
- **THEN** all three native gates are skipped and shared OpenSpec validation still runs

#### Scenario: Runtime removed or renamed

- **WHEN** a PR deletes a runtime file or renames one to a Markdown path
- **THEN** all three native gates run

#### Scenario: Unknown input or main push

- **WHEN** a PR changes an unrecognized path or CI runs for a non-PR event
- **THEN** all three complete native gates run without reduced tests or coverage

### Requirement: Stable fail-closed contexts

CI SHALL preserve `check (ubuntu-latest)`, `check (macos-15)` and `check (windows-latest)` as separate required contexts when selected or skipped. Failed classification or missing classification output SHALL fail the native contexts instead of silently passing or skipping them.

#### Scenario: Classifier cannot read the complete diff

- **WHEN** classification fails or its native selection output is absent
- **THEN** each native context fails and shared OpenSpec validation remains independent

#### Scenario: Native gates are not needed

- **WHEN** classification successfully excludes native work
- **THEN** each exact native context is reported separately as skipped
