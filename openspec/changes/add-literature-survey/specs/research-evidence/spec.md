# Spec Delta

## ADDED Requirements

### Requirement: Handover of coverage questions

The skill SHALL direct questions about what exists on a topic to the literature-survey skill and SHALL keep its own workflow for individual works.

#### Scenario: Coverage question reaches the evidence skill

- **WHEN** an agent that follows the research-evidence workflow is asked for the state of the art or the prior art on a topic
- **THEN** the skill points it to the literature-survey skill

### Requirement: Screening on title and abstract

The workflow SHALL screen a candidate on its title and abstract and SHALL NOT reject a candidate on its title alone.

#### Scenario: Candidate with an unhelpful title

- **WHEN** a candidate's title does not show whether the work is relevant
- **THEN** the agent reads the abstract before it keeps or rejects the candidate
