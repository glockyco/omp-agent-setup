# research-evidence Specification

## Purpose
Define one evidence workflow that finds, acquires, reads, verifies, and registers literature without fabricated metadata or unsupported characterization.
## Requirements
### Requirement: Ordered evidence workflow

The skill SHALL guide `search -> screen -> acquire -> read -> verify metadata -> register` and SHALL require relevant full-text reading before characterizing a paper.

#### Scenario: Add a paper to a writing repository

- **WHEN** a DOI, arXiv identifier, or candidate title is supplied
- **THEN** the workflow verifies authoritative metadata, acquires and reads relevant text, and only then registers the citation

### Requirement: Acquisition precedence

Acquisition SHALL try the publisher-hosted open-access published version, Sci-Hub published version, green-open-access manuscript, arXiv, and manual author or institutional access in that order.

#### Scenario: Earlier source succeeds

- **WHEN** an earlier source yields a valid PDF
- **THEN** later sources are not queried and the selected source class is reported

### Requirement: Deterministic PDF validation

The acquisition helper SHALL resolve Sci-Hub viewer URLs, including relative paths, and SHALL reject any response whose bytes do not begin with `%PDF-`.

#### Scenario: Viewer page names a relative PDF

- **WHEN** a deterministic fixture contains a relative viewer path followed by valid PDF bytes
- **THEN** the helper resolves the absolute URL and returns the PDF with its source metadata

#### Scenario: Endpoint returns HTML

- **WHEN** a candidate PDF URL returns non-PDF content
- **THEN** the helper rejects it and does not save it as a paper

### Requirement: Explicit service identity

Unpaywall access SHALL require an explicit `UNPAYWALL_EMAIL`; no fabricated default identity is allowed.

#### Scenario: Unpaywall identity is absent

- **WHEN** the workflow reaches Unpaywall without `UNPAYWALL_EMAIL`
- **THEN** it reports the missing configuration instead of issuing the request

### Requirement: Citation consistency

Changing a BibTeX key SHALL update every citation callsite, and metadata SHALL come from Crossref, OpenAlex, DBLP, the publisher, or the paper.

#### Scenario: Normalize an existing citation

- **WHEN** a citation key changes during registration
- **THEN** all callsites are changed in the same operation and no field is guessed

