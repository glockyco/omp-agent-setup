## ADDED Requirements

### Requirement: Self-contained commit messages

A commit body SHALL give the reason for the change, not who asked for it. It SHALL NOT cite a request, feedback, or the conversation as the reason. The commit policy and the `personal_commit` `body` field description SHALL both state this.

#### Scenario: Revise work after feedback

- **WHEN** the agent commits a revision that follows feedback
- **THEN** the body states why the revision is needed
- **AND** it contains no phrase such as "as requested", "per feedback", or "the user asked"

#### Scenario: Inspect the tool before a call

- **WHEN** an agent reads the `personal_commit` `body` field description
- **THEN** it states that the body gives the reason, not who asked
