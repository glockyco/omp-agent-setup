# literature-survey Specification

## Purpose
Answer questions about what the literature holds on a topic with searches whose reach is recorded, so that a statement about what exists or is missing can be checked.

## Requirements

### Requirement: Survey scope

The research-evidence skill SHALL answer coverage questions, such as the state of the art, prior art, the novelty of an idea and how much has been published on a topic, by running the survey program. Each individual work SHALL go through the research-evidence workflow for acquisition, reading, metadata and registration.

#### Scenario: Coverage question

- **WHEN** the person asks what has been published on a topic or whether an idea has been studied
- **THEN** the agent runs the survey program before it reads or reports

#### Scenario: Single citation

- **WHEN** the person asks to verify or add one named work
- **THEN** the agent follows the research-evidence workflow and starts no survey

### Requirement: Complementary channels

The survey program SHALL run OpenAlex semantic search, OpenAlex keyword search, arXiv search and citation expansion for every survey. When a channel fails, the program SHALL stop and report what blocks it instead of continuing without it. Works the agent finds on the web SHALL enter the corpus through the program and be marked as web finds.

#### Scenario: All channels run

- **WHEN** a survey runs
- **THEN** the query log holds semantic, keyword, arXiv and citation queries for it

#### Scenario: A channel is unavailable

- **WHEN** an index refuses its queries during a survey
- **THEN** the program stops and names the failed channel and its error
- **AND** it produces no coverage numbers for the incomplete run

#### Scenario: Web find

- **WHEN** the agent adds a work it found on the web
- **THEN** the work is screened like every other record and counted as a web find

### Requirement: Paced index queries

The search helper SHALL space its requests per index, SHALL retry a throttled request after the wait the index indicates or with exponential backoff, and SHALL stop after a bounded number of attempts. All searches of one user SHALL share the spacing through one pacing directory, whatever survey directory they write to. For arXiv, Semantic Scholar and OpenAlex semantic search, the helper SHALL keep at most one request open per index at a time.

#### Scenario: Throttled request

- **WHEN** an index answers a query with a throttling status and a wait time
- **THEN** the helper waits that time and repeats the request
- **AND** it gives up after the bounded number of attempts

#### Scenario: Two agents search at once

- **WHEN** two helper processes with different survey directories query the same index
- **THEN** their requests to that index keep the configured spacing

#### Scenario: Slow answers from arXiv

- **WHEN** two processes search arXiv and each answer takes longer than the spacing
- **THEN** the second request starts only after the first answer arrived

### Requirement: Failure is not absence

The helper SHALL report a query that did not complete as failed, distinct from a query with no hits. The workflow SHALL NOT base a statement that nothing was found on a failed query.

#### Scenario: Query fails

- **WHEN** every attempt of a query is refused or times out
- **THEN** the result and the log mark the query as failed
- **AND** the result says that the failure is no evidence of absence

### Requirement: Query log

The helper SHALL append every index query to a log with its time, index, query, filters, sort order, status, total hits and returned count. The log SHALL NOT contain a key.

#### Scenario: Keyed query is logged

- **WHEN** a keyed query completes
- **THEN** the log gains one entry with the listed fields
- **AND** the key appears nowhere in the entry

### Requirement: Corpus with abstracts

The helper SHALL write results to a corpus with one record per work. A record SHALL carry the DOI or preprint identifier, title, authors, date, venue, the abstract when the index provides one, and the queries that returned the work.

#### Scenario: Two indexes return the same work

- **WHEN** two queries on different indexes return a work with the same identifier
- **THEN** the corpus holds one record that lists both queries

### Requirement: Recorded screening

The survey program SHALL screen with a model, against criteria derived from the question, every record of the first round and in each expansion round the records reached by the most core works up to a per-round limit. It SHALL record for each screened record the decision and which criteria it met, and SHALL count the records it left unscreened in the coverage numbers. A record without an abstract SHALL stay undecided.

#### Scenario: Every record is decided or counted

- **WHEN** a survey ends on saturation or its round limit
- **THEN** every first-round record with an abstract has a recorded decision
- **AND** the coverage numbers state how many later records were left unscreened

#### Scenario: Most linked records first

- **WHEN** an expansion round reaches more records than its limit
- **THEN** the records reached by more core works are screened before those reached by fewer

#### Scenario: Record without an abstract

- **WHEN** a corpus record has no abstract
- **THEN** the record is marked undecided and is neither kept nor rejected

### Requirement: Keyed index access for the helper

The helper SHALL read an index key from a file whose path it receives and SHALL NOT accept a key as an argument value. For an index that bills searches, it SHALL refuse a search without a key file and SHALL say how to get the key.

#### Scenario: Key file is given

- **WHEN** the helper receives the path of a key file
- **THEN** it sends the key in a request header
- **AND** the process arguments contain the path and not the key

#### Scenario: Search without a key file

- **WHEN** the helper is asked to search a billing index and receives no key file
- **THEN** it sends no request and fails with a message that names the missing key

### Requirement: Survey report

A survey report SHALL quote the coverage numbers the program wrote, SHALL phrase a gap as not found by these channels, and SHALL state for each cited work how much was read and by whom.

#### Scenario: Gap in the literature

- **WHEN** the report states that no work on a question was found
- **THEN** it quotes the channel counts, their overlap and the works the last round added

#### Scenario: Work read by a subagent

- **WHEN** a cited work was read by a subagent and not by the reporting agent
- **THEN** the report says so and names the part that was read

### Requirement: Host-native search helper

The search helper SHALL run under host-owned Python 3 with the standard library only, on Linux, macOS and native Windows, including from an installed path that contains spaces. The survey program SHALL run under the same Python, as a command line program or loaded into the eval Python kernel, and SHALL use the search helper for every index request. Their automated tests SHALL use local fixtures and no live service.

#### Scenario: Run the installed helper on Windows

- **WHEN** a native Windows user invokes the installed helper with host Python and a quoted path that contains spaces
- **THEN** the fixture scenarios pass as on Linux and macOS

#### Scenario: Release without the helper

- **WHEN** a release tree lacks a readable search helper or survey program
- **THEN** release verification fails

### Requirement: Saturation rounds

The survey program SHALL expand every core work through its references, citing works, related works and a semantic search seeded with it, and SHALL repeat screening and expansion until a round adds fewer than two core works, the round limit of the chosen depth is reached, or the screening budget is spent. The coverage numbers SHALL state which condition ended the survey.

#### Scenario: Survey saturates

- **WHEN** a round adds one core work
- **THEN** the program stops and records saturation as the reason

#### Scenario: Budget runs out

- **WHEN** the screening budget is spent before saturation
- **THEN** the coverage numbers say that the survey ended on the budget, not on saturation

### Requirement: Search depth and continuation

The survey program SHALL offer an overview depth with one expansion round and a small screening budget, and an exhaustive depth that runs until saturation. A run on a directory that holds an earlier survey SHALL keep its plan, harvest and decisions and continue its rounds. A survey that did not saturate SHALL state in its coverage that it supports no statement that a work does not exist or that an idea is new.

#### Scenario: Overview grows into an exhaustive search

- **WHEN** an overview has run and the program runs again on the same directory with the exhaustive depth
- **THEN** it plans and harvests nothing again and continues with the next expansion round

#### Scenario: Overview report

- **WHEN** an overview ends on its round limit
- **THEN** coverage.md says that the search did not saturate and how to continue it

### Requirement: Progress record

The survey program SHALL append every search, screening step and the end of the run to `progress.jsonl` in the survey directory, SHALL pass each step to a progress callback when one is given, and SHALL print each step as one line to standard output when it runs as a command.

#### Scenario: Following a running survey

- **WHEN** a survey is running
- **THEN** `progress.jsonl` holds one line per completed search and screening step with its counts

#### Scenario: Following a survey run as a command

- **WHEN** the survey runs as a command
- **THEN** each step appears as one line on standard output while it runs

### Requirement: Coverage estimate

The survey program SHALL report the core works found by each channel, the overlap of the first-round semantic and keyword channels, a Lincoln-Petersen estimate of the total when the overlap is not empty, and the statement that correlated channels make the estimate too low.

#### Scenario: Channels overlap

- **WHEN** semantic search found 24 core works, keyword search 19 and both 9
- **THEN** the coverage numbers report an estimate of about 51 works

#### Scenario: Channels do not overlap

- **WHEN** the two channels share no core work
- **THEN** the coverage numbers report that no estimate is possible and that coverage is unknown

### Requirement: Known-work probe

When the person names works known to be relevant, the survey program SHALL report whether the harvest found each of them before they were added to the corpus.

#### Scenario: Known work missed

- **WHEN** a named known work is not among the harvested candidates
- **THEN** the coverage numbers list it as missed by the search

### Requirement: Canary benchmark

The survey program SHALL offer a benchmark that runs the survey on questions from a private file and reports for each listed work whether it reached the candidates, the core set and the related set.

#### Scenario: Benchmark run

- **WHEN** the benchmark runs on a file with five questions
- **THEN** it writes per question and per listed work the stage the work reached

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
