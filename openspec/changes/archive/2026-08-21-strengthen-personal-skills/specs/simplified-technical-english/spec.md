## MODIFIED Requirements

### Requirement: Writing modes and protected technical text

The skill SHALL distinguish procedural and descriptive text, their sentence limits, strict and pragmatic use, and protected code, identifiers, commands, paths, product names, and quotations.

Pragmatic use SHALL cover technical documentation, plans, proposals, designs, specifications, task descriptions, commit and pull request text, code comments, docstrings, API descriptions, CLI text, error messages, procedures, runbooks, release notes, incident reports, and agent instructions.

The skill SHALL treat comments and docstrings as prose while preserving the technical tokens inside them. It SHALL NOT require unrelated comments to be rewritten.

#### Scenario: Apply pragmatic guidance

- **WHEN** an agent writes or materially revises covered technical prose without an explicit compliance request
- **THEN** it applies pragmatic STE guidance and preserves protected technical tokens

#### Scenario: Revise a code comment

- **WHEN** an agent adds or materially revises a code comment or docstring
- **THEN** it applies pragmatic STE guidance to the prose
- **AND** it preserves identifiers, commands, paths, quotations, and other protected technical tokens
- **AND** it leaves unrelated comments unchanged
