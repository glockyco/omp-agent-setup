## Purpose

Define the validation every repository on this workstation applies to its own OpenSpec artifacts, and how this repository supplies that validation as one definition every repository consumes rather than copies.

## ADDED Requirements

### Requirement: Every repository holding OpenSpec artifacts is verified

A repository that contains an `openspec/` directory SHALL fail its continuous integration when an artifact is invalid under strict validation, or when an archived change contains an unchecked task.

The same verification SHALL be reproducible on a development machine without network access once its inputs are fetched, so a maintainer can see the failure before pushing.

#### Scenario: Invalid artifact reaches the default branch

- **WHEN** a repository holding OpenSpec artifacts contains an artifact that fails strict validation
- **THEN** its continuous integration fails
- **AND** the failure identifies the artifact

#### Scenario: Change archived with unfinished work

- **WHEN** an archived change in such a repository contains an unchecked task
- **THEN** its continuous integration fails
- **AND** the failure names the change and the count of unchecked tasks

#### Scenario: Reproducing a failure locally

- **WHEN** a maintainer runs the repository's checks on a machine that has already fetched the inputs
- **THEN** the same verification runs without network access
- **AND** it reports the same result as continuous integration

### Requirement: One definition, consumed rather than copied

This repository SHALL expose the verification as a flake output that other repositories consume. A consuming repository SHALL NOT contain the validation commands, their flags, or a second implementation of them.

#### Scenario: The verification changes

- **WHEN** the commands or flags in the shared definition change
- **THEN** a consuming repository picks the change up by updating its lock
- **AND** no file describing how validation runs is edited in that repository

#### Scenario: A repository adopts the verification

- **WHEN** a repository adopts the shared definition
- **THEN** it declares the input and references the output
- **AND** it states nothing about which commands run

#### Scenario: No repository keeps its own implementation

- **WHEN** the repositories are searched for the validation commands
- **THEN** they appear only in the shared definition

### Requirement: The shared definition owns the pinned version

The shared definition SHALL pin the OpenSpec version it runs. A consuming repository SHALL NOT pin the OpenSpec CLI itself, and SHALL NOT depend on a CLI installed outside the verification.

The pinned version SHALL support both validations. A version that cannot check archived task completion SHALL NOT be used, whatever its other merits.

#### Scenario: A consuming repository is inspected

- **WHEN** a consuming repository is searched for an OpenSpec CLI dependency
- **THEN** it declares none
- **AND** the version it validates with comes from the shared definition through its lock

#### Scenario: Upgrading the version

- **WHEN** the OpenSpec version in the shared definition is raised
- **THEN** each consuming repository adopts it by updating that input
- **AND** no consuming repository is edited to name the new version

#### Scenario: A candidate version lacks the archive check

- **WHEN** a version under consideration does not support validating archived task completion
- **THEN** it is rejected as a source for the shared definition

### Requirement: The verification reads only the artifacts

The shared definition SHALL read the consuming repository's OpenSpec artifacts and nothing else, so that unrelated files neither enter the verification nor cause it to re-run.

#### Scenario: A repository carries large unrelated files

- **WHEN** a repository containing large build outputs or documents is verified
- **THEN** only its OpenSpec artifacts are read

#### Scenario: An unrelated file changes

- **WHEN** a file outside the OpenSpec artifacts changes
- **THEN** the verification result is reused rather than recomputed
