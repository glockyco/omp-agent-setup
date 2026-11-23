# Spec Delta

## Purpose

Answer questions about what the literature holds on a topic with searches whose reach is recorded, so that a statement about what exists or is missing can be checked.

## ADDED Requirements

### Requirement: Survey scope

The skill SHALL apply to coverage questions: the state of the art, prior art, the novelty of an idea and how much has been published on a topic. It SHALL hand each individual work to the research-evidence workflow for acquisition, reading, metadata and registration.

#### Scenario: Coverage question

- **WHEN** the person asks what has been published on a topic or whether an idea has been studied
- **THEN** the agent follows the survey workflow

#### Scenario: Single citation

- **WHEN** the person asks to verify or add one named work
- **THEN** the agent follows the research-evidence workflow and starts no survey

### Requirement: Complementary channels

For each survey question the workflow SHALL search at least one enumerable index, the web, and the citation links of the closest works. When one of them cannot run, the workflow SHALL stop and ask the person before it goes on without it. The report SHALL state for each channel whether it ran.

#### Scenario: All channels run

- **WHEN** a survey question is searched
- **THEN** the query log holds index queries and citation-link queries for it
- **AND** the report names the web searches

#### Scenario: A channel is unavailable

- **WHEN** an index refuses its queries during the survey
- **THEN** the agent stops the survey and tells the person what blocks the index and what would remove the block
- **AND** it goes on without the index only after the person says so, and the report then names the missing channel

### Requirement: Paced index queries

The search helper SHALL space its requests per index, SHALL retry a throttled request after the wait the index indicates, and SHALL stop after a bounded number of attempts. Invocations that share a state directory SHALL share the spacing.

#### Scenario: Throttled request

- **WHEN** an index answers a query with a throttling status and a wait time
- **THEN** the helper waits that time and repeats the request
- **AND** it gives up after the bounded number of attempts

#### Scenario: Two agents search at once

- **WHEN** two helper processes with the same state directory query the same index
- **THEN** their requests to that index keep the configured spacing

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

A screening decision SHALL rest on title and abstract and SHALL be recorded with one factual reason. A record without an abstract SHALL get one from another source or stay undecided.

#### Scenario: Record without an abstract

- **WHEN** a corpus record has no abstract and no other source provides one
- **THEN** the record is marked undecided
- **AND** it is neither kept nor rejected on its title

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

A survey report SHALL state how the search was done, with channels, number of queries, date range and failures. It SHALL phrase a gap as not found by these queries. For each cited work it SHALL state how much was read and by whom.

#### Scenario: Work read by a subagent

- **WHEN** a cited work was read by a subagent and not by the reporting agent
- **THEN** the report says so and names the part that was read

#### Scenario: Gap in the literature

- **WHEN** the report states that no work on a question was found
- **THEN** it refers to the logged queries and names the channels that ran

### Requirement: Host-native search helper

The search helper SHALL run under host-owned Python 3 with the standard library only, on Linux, macOS and native Windows, including from an installed path that contains spaces. Its automated tests SHALL use local fixtures and no live service.

#### Scenario: Run the installed helper on Windows

- **WHEN** a native Windows user invokes the installed helper with host Python and a quoted path that contains spaces
- **THEN** the fixture scenarios pass as on Linux and macOS

#### Scenario: Release without the helper

- **WHEN** a release tree lacks a readable search helper
- **THEN** release verification fails
