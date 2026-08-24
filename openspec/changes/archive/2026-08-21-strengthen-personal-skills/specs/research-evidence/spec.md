## MODIFIED Requirements

### Requirement: Ordered evidence workflow

For a paper search or evidence request, the skill SHALL guide `search -> screen -> acquire -> read -> verify metadata -> register` and SHALL require relevant full-text reading before characterizing a paper.

For metadata-only citation maintenance, the skill SHALL verify authoritative metadata and update the registration without requiring unrelated search, acquisition, or full-text reading. It SHALL enter the full workflow when the request also requires paper characterization or evidence for a claim.

#### Scenario: Add a paper to a writing repository

- **WHEN** a DOI, arXiv identifier, or candidate title is supplied for use as evidence
- **THEN** the workflow verifies authoritative metadata, acquires and reads relevant text, and only then registers and characterizes the citation

#### Scenario: Repair citation metadata only

- **WHEN** the user asks only to verify a DOI or correct an existing bibliography entry
- **THEN** the workflow verifies the metadata against authoritative sources and updates the registration
- **AND** it does not search for, acquire, or read full text unless that work is necessary to resolve the metadata

### Requirement: Acquisition precedence

Acquisition SHALL use DOI and open-access metadata to test for a publisher-hosted open-access published version without requiring interpretation of a publisher page. It SHALL then try the publisher-hosted open-access published version, Sci-Hub published version, green-open-access manuscript, arXiv, and manual author or institutional access in that order.

#### Scenario: Earlier source succeeds

- **WHEN** an earlier source yields a valid PDF
- **THEN** later sources are not queried and the selected source class is reported

#### Scenario: Publisher version is not open access

- **WHEN** authoritative metadata provides no publisher-hosted open-access PDF
- **THEN** acquisition continues to Sci-Hub without spending an agent interaction on a paywalled publisher page

### Requirement: Citation consistency

Changing a BibTeX key SHALL update every citation callsite, and metadata SHALL come from Crossref, OpenAlex, DBLP, the publisher, or the paper. Repository bibliography location, key, field, formatting, and ordering conventions SHALL take precedence over skill defaults. The skill SHALL use its BibTeX defaults only when the repository defines no applicable convention.

#### Scenario: Normalize an existing citation

- **WHEN** a citation key changes during registration
- **THEN** all callsites are changed in the same operation and no field is guessed
- **AND** the updated entry follows the repository's existing bibliography conventions

#### Scenario: Repository defines no bibliography convention

- **WHEN** a new or updated BibTeX entry has no applicable repository convention
- **THEN** the workflow applies the skill's documented defaults

## ADDED Requirements

### Requirement: Evidence characterization

When the workflow characterizes a paper as evidence, it SHALL record the supported claim, the supporting page, section, figure, table, or quotation, the relevant method or data, the relevant result, material limitations, and whether full text was read. It SHALL omit fields that do not apply instead of adding empty boilerplate.

#### Scenario: Record evidence for a claim

- **WHEN** the agent uses a paper to support a technical claim
- **THEN** the evidence record connects the claim to a precise location in text that the agent read
- **AND** it records the method or data, result, and limitations that affect the claim
- **AND** it does not add irrelevant placeholder fields

### Requirement: Computer-science research focus

The skill SHALL optimize its default sources and guidance for computer science and adjacent technical literature. It SHALL use other domain-specific sources only when the task or repository requires them, without adding unrelated domain workflows to ordinary computer-science research.

#### Scenario: Search computer-science literature

- **WHEN** the user requests evidence for a computer-science topic
- **THEN** the workflow uses its computer-science search and citation sources without introducing unrelated domain databases or systematic-review procedures
