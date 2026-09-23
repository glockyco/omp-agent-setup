## Purpose

Make the complete Research Paper Writing Skills guidance available in personal OMP sessions for planning, drafting, revising, and reviewing research papers without changing the separate evidence-verification workflow.

## ADDED Requirements

### Requirement: Discoverable complete writing skill

The personal OMP plugin SHALL provide one discoverable `research-paper-writing` skill with its upstream core workflow and all supporting section guides and examples available from the immutable plugin package. The package SHALL preserve upstream attribution and redistribution notices and SHALL not require a mutable checkout or runtime download.

#### Scenario: Discover a packaged writing skill

- **WHEN** a wrapped OMP session loads the personal plugin from its packaged path
- **THEN** it can discover the `research-paper-writing` skill and read its linked section guides and examples from that same package

#### Scenario: Load without external installation

- **WHEN** the skill is requested in a session without an upstream checkout or package manager
- **THEN** its guidance is available without fetching or installing the upstream repository

### Requirement: Outline-first drafting and review

The skill SHALL guide the agent to establish the paper story and section outline before drafting detailed paragraphs. It SHALL support paragraph flow checks, reverse outlining of existing prose, claim-to-evidence review, and skeptical pre-submission review through the applicable section guides.

#### Scenario: Plan a paper section

- **WHEN** a user asks for help drafting an introduction or another supported paper section
- **THEN** the agent can follow the upstream outline-first workflow and consult the guide for that section

#### Scenario: Review an existing draft

- **WHEN** a user asks whether a section flows or its major claims are supported
- **THEN** the agent can reverse-outline its paragraphs and identify claims needing evidence rather than presenting unsupported claims as verified

### Requirement: Independent writing and evidence guidance

The writing skill SHALL coexist with the existing `research-evidence` skill. Adding it SHALL NOT replace the evidence skill, claim automatic source verification, or impose a separate AI4SE reporting skill or one universal paper-type checklist.

#### Scenario: Request writing and source verification

- **WHEN** a user requests both a paper revision and verification of cited research
- **THEN** the writing guidance remains available for structure and presentation
- **AND** the existing evidence workflow remains available for source verification
