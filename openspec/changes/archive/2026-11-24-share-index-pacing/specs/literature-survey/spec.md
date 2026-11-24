## MODIFIED Requirements

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
