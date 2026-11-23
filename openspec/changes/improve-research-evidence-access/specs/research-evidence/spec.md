# Spec Delta

## ADDED Requirements

### Requirement: Routes around refusing hosts

The skill SHALL name the hosts that refuse scripted requests and SHALL direct agents not to request them directly. For each listed host it SHALL give a route that works: metadata and abstracts from an authoritative index, full text through the acquisition order, the person's browser session, or the person.

#### Scenario: Work hosted on a refusing publisher site

- **WHEN** an agent needs the abstract or the full text of a work whose landing page is on a listed host
- **THEN** it takes the metadata from an authoritative index and requests the full text through the acquisition order
- **AND** it sends no direct request to the listed host

#### Scenario: Listed route is confirmed

- **WHEN** a host and its route enter the skill
- **THEN** the change record shows the refusal and a successful use of the route on that host

### Requirement: Online full text as a reading source

The workflow SHALL accept full text that an open host serves as HTML as read text. An evidence record from such text SHALL give the section, figure, table or quotation in place of a page, and SHALL name the version that was read.

#### Scenario: Preprint read as HTML

- **WHEN** an agent reads the relevant section of a preprint on its HTML page
- **THEN** the evidence record counts as a full-text reading
- **AND** it names the section or quotation and the preprint version

### Requirement: Version-of-record disclosure

The acquisition helper SHALL report a distinct result when the DOI names a published work and only a manuscript was obtained. The result SHALL name the source, keep the file, and exit with a status that differs from success and from failure. The skill SHALL direct the agent to ask the person before citing from that copy.

#### Scenario: Publisher DOI yields a manuscript

- **WHEN** the DOI names a published work and the first valid PDF comes from a repository or from arXiv
- **THEN** the helper saves the file, reports that the published version was not obtained, and exits with the manuscript status
- **AND** the skill has the agent ask the person before it cites from the file

#### Scenario: DOI of a preprint

- **WHEN** the open-access metadata describes the DOI as posted content and a repository returns a valid PDF
- **THEN** the helper reports an ordinary success

### Requirement: Failed open-access lookup stops acquisition

When the open-access metadata service cannot be reached or returns an unreadable answer, the acquisition helper SHALL stop with a failure that names the lookup and SHALL try no source. An answer that the service does not know the DOI is not a failure.

#### Scenario: Lookup times out

- **WHEN** the open-access lookup fails for a DOI while a manuscript copy is reachable
- **THEN** the helper requests no source and saves no file
- **AND** its failure message says that the lookup failed and that it can be run again

#### Scenario: Service does not know the DOI

- **WHEN** the open-access service answers that it has no record of the DOI
- **THEN** the helper goes on to the later sources

### Requirement: Published version check for preprints

Before the workflow registers a preprint, it SHALL check authoritative indexes for a published version and SHALL register the published version when one exists.

#### Scenario: Preprint with a later proceedings paper

- **WHEN** a candidate is identified by its preprint and an authoritative index lists a published version
- **THEN** the registered entry is the published version with its DOI and venue

#### Scenario: Preprint without a published version

- **WHEN** no authoritative index lists a published version
- **THEN** the work is registered as a preprint

### Requirement: Keyed OpenAlex access

The skill SHALL direct agents to obtain the OpenAlex key through the `vault` tool and to send it in a request header read from the delivered file. The key SHALL NOT appear in a URL, a tool argument or a log. Without the key, the skill SHALL have the agent stop the search and ask the person for the entry or its approval. It SHALL NOT direct a search without the key.

#### Scenario: Key is available

- **WHEN** an agent queries OpenAlex and the vault delivers the key
- **THEN** the request carries the key in a header taken from the delivered file
- **AND** no tool argument contains the key

#### Scenario: Key is not available

- **WHEN** the vault holds no OpenAlex entry or the delivery is refused
- **THEN** the agent sends no search without the key
- **AND** it asks the person to add or approve the entry

## MODIFIED Requirements

### Requirement: Explicit service identity

Unpaywall access SHALL require an explicit `UNPAYWALL_EMAIL`; no fabricated default identity is allowed. The skill SHALL direct agents to take the address from the host environment only.

#### Scenario: Unpaywall identity is absent

- **WHEN** the workflow reaches Unpaywall without `UNPAYWALL_EMAIL`
- **THEN** it reports the missing configuration instead of issuing the request

#### Scenario: Agent finds the variable unset

- **WHEN** an agent prepares an acquisition command and the host environment has no `UNPAYWALL_EMAIL`
- **THEN** it does not set the variable in the command
- **AND** it reports the missing host configuration
