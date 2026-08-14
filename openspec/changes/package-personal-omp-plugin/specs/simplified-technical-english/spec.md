## Purpose

Define traceable, honest STE-based writing guidance that preserves the complete ASD-STE100 rule relationship without claiming unaudited compliance.

## ADDED Requirements

### Requirement: Complete rule traceability

The skill SHALL identify ASD-STE100 Issue 9, STEMG, the official source, all 53 rule identifiers in nine sections, and each rule's relationship to the controlled dictionary.

#### Scenario: Validate the rule index

- **WHEN** the traceability check reads `references/rules.md`
- **THEN** it finds exactly the expected 53 unique identifiers and every checklist citation resolves to one of them

### Requirement: Writing modes and protected technical text

The skill SHALL distinguish procedural and descriptive text, their sentence limits, strict and pragmatic use, and protected code, identifiers, commands, paths, product names, and quotations.

#### Scenario: Apply pragmatic guidance

- **WHEN** a user requests clear technical prose without an explicit compliance claim
- **THEN** the skill describes the result as STE-based and preserves protected technical tokens

### Requirement: Compliance boundary

The skill SHALL state its non-affiliation, require the official dictionary and qualified human review for strict compliance, and expose the checksum and audit status of the official source without committing the copyrighted PDF.

#### Scenario: Official copy has not been supplied

- **WHEN** the local traceability record has no official Issue 9 checksum
- **THEN** the rule paraphrase audit is explicitly marked unverified and the skill makes no compliance claim

#### Scenario: Official audit is complete

- **WHEN** a qualified reviewer audits every paraphrase against a locally held official copy
- **THEN** the local traceability record contains its checksum and review status while the repository contains no copyrighted standard or complete dictionary
