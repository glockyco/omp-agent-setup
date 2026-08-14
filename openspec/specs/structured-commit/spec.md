# structured-commit Specification

## Purpose
Define semantic commit guidance and structured commit transport that preserves repository hooks and never expands into repository-management policy.
## Requirements
### Requirement: Structured commit input

The `personal_commit` tool SHALL accept `commit`, `amend`, and `preview` actions with separate subject and body fields. It SHALL require a causal body and reject literal `\\n` text.

#### Scenario: Preview a valid message

- **WHEN** the tool receives `preview`, a Conventional Commit subject, and a causal body
- **THEN** it returns the exact formatted message without invoking Git

#### Scenario: Reject escaped newlines

- **WHEN** either structured text field contains literal `\\n`
- **THEN** the tool rejects the input before writing or executing anything

### Requirement: Stable message formatting

The tool SHALL preserve paragraph boundaries, wrap ordinary prose to 72 columns, and SHALL NOT split URLs, code tokens, or other indivisible long tokens.

#### Scenario: Format multiple paragraphs

- **WHEN** the body contains two paragraphs and an overlong URL
- **THEN** ordinary words wrap, the blank line remains, and the URL remains intact

### Requirement: Hook-preserving Git execution

For commit and amend, the tool SHALL write one temporary message file and invoke `git commit -F` or `git commit --amend -F` in the session working directory.

#### Scenario: Repository has a commit hook

- **WHEN** the tool creates a commit in a disposable repository with a working hook
- **THEN** the hook runs and Git records the formatted subject and causal body

### Requirement: Repository authority

The tool SHALL NOT stage, push, pass `--no-verify`, validate repository-specific type or scope enums itself, invoke planning tools, or depend on `bunx`.

#### Scenario: Inspect transport side effects

- **WHEN** a commit succeeds
- **THEN** the only Git mutation requested by the tool is the requested commit or amend operation and repository hooks remain authoritative

