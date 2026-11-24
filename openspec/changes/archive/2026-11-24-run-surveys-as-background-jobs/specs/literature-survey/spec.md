## MODIFIED Requirements

### Requirement: Host-native search helper

The search helper SHALL run under host-owned Python 3 with the standard library only, on Linux, macOS and native Windows, including from an installed path that contains spaces. The survey program SHALL run under the same Python, as a command line program or loaded into the eval Python kernel, and SHALL use the search helper for every index request. Their automated tests SHALL use local fixtures and no live service.

#### Scenario: Run the installed helper on Windows

- **WHEN** a native Windows user invokes the installed helper with host Python and a quoted path that contains spaces
- **THEN** the fixture scenarios pass as on Linux and macOS

#### Scenario: Release without the helper

- **WHEN** a release tree lacks a readable search helper or survey program
- **THEN** release verification fails

### Requirement: Progress record

The survey program SHALL append every search, screening step and the end of the run to `progress.jsonl` in the survey directory, SHALL pass each step to a progress callback when one is given, and SHALL print each step as one line to standard output when it runs as a command.

#### Scenario: Following a running survey

- **WHEN** a survey is running
- **THEN** `progress.jsonl` holds one line per completed search and screening step with its counts

#### Scenario: Following a survey run as a command

- **WHEN** the survey runs as a command
- **THEN** each step appears as one line on standard output while it runs

## ADDED Requirements

### Requirement: Survey command line

The survey program SHALL offer a `run` command that surveys a question into a directory at a chosen depth and an `add` command that screens given works into an existing survey. The commands SHALL make their model calls through `omp auth-gateway stdio`, the plan with the default role and the screening with the small role, and SHALL read the first JSON object of each answer.

#### Scenario: Survey without the eval kernel

- **WHEN** the `run` command runs with an OpenAlex key file and a gateway that answers the plan and screening requests
- **THEN** the survey writes its plan, decisions, `kept.md` and `coverage.md` as it does in the kernel

#### Scenario: Answer wrapped in a code fence

- **WHEN** the gateway returns the JSON answer inside a Markdown code fence
- **THEN** the program reads the JSON object inside it

### Requirement: Survey status and registry

A running survey SHALL keep `status.json` in its directory current with its question, depth, state, last step, round, screened records, budget, core and related works and times, at every step and at least every 30 seconds. Its states SHALL be `running`, `done`, `stopped`, `blocked` and `failed`. A survey SHALL record its directory once in a per-user registry, `~/.cache/research-evidence/surveys.jsonl` unless `RESEARCH_EVIDENCE_REGISTRY` names another file.

#### Scenario: Status while running

- **WHEN** a survey is screening its first round
- **THEN** `status.json` says `running` with the step, the screened records and the budget

#### Scenario: Channel fails

- **WHEN** a channel fails and the survey stops
- **THEN** `status.json` says `blocked` with the reason

#### Scenario: Second run on a directory

- **WHEN** a survey runs again on a directory already in the registry
- **THEN** the registry still holds that directory once

### Requirement: Stop request

A survey SHALL stop at its next step when a file named `stop` exists in its directory, SHALL set its state to `stopped`, and SHALL remove the file, so that a later run on the directory continues.

#### Scenario: Stop while screening

- **WHEN** a `stop` file appears while the survey runs
- **THEN** the survey ends at its next step with the state `stopped` and the file is gone

### Requirement: Survey location and reuse

The research-evidence skill SHALL start a survey as a background job whose milestones wake the agent, SHALL keep each survey directory in the folder of the vault item it serves, SHALL look for that item's earlier surveys before starting a new one, and SHALL show `kept.md` beside the chat when the survey ends.

#### Scenario: Earlier survey of the same item

- **WHEN** an item's folder already holds a survey of the question
- **THEN** the agent continues that survey instead of starting a new directory
