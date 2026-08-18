## MODIFIED Requirements

### Requirement: Hook-preserving Git execution

For commit and amend, the tool SHALL write one temporary message file and invoke `git commit -F` or
`git commit --amend -F` in the target repository. The target SHALL be the optional `repo` input when
given, resolved against the session working directory when relative, and the session working directory
otherwise.

The tool SHALL reject a `repo` that does not exist, is not a directory, or is not inside a Git work
tree, and SHALL do so before writing a message file or invoking Git.

#### Scenario: Repository has a commit hook

- **WHEN** the tool creates a commit in a disposable repository with a working hook
- **THEN** the hook runs and Git records the formatted subject and causal body

#### Scenario: Commit in a repository other than the session's

- **WHEN** the tool receives a `repo` naming a different repository with staged changes
- **THEN** Git records the commit in that repository
- **AND** the session repository is left untouched

#### Scenario: Target is not a repository

- **WHEN** the tool receives a `repo` that does not exist, is not a directory, or is outside any Git
  work tree
- **THEN** it rejects the input and names the offending path
- **AND** it writes no message file and invokes no Git mutation

#### Scenario: No target is given

- **WHEN** the tool receives no `repo`
- **THEN** it commits in the session working directory

### Requirement: Structured commit input

The `personal_commit` tool SHALL accept `commit`, `amend`, and `preview` actions with separate subject
and body fields, and an optional `repo` field naming the target repository. It SHALL require a causal
body and reject literal `\\n` text.

#### Scenario: Preview a valid message

- **WHEN** the tool receives `preview`, a Conventional Commit subject, and a causal body
- **THEN** it returns the exact formatted message without invoking Git

#### Scenario: Reject escaped newlines

- **WHEN** either structured text field contains literal `\\n`
- **THEN** the tool rejects the input before writing or executing anything

## ADDED Requirements

### Requirement: Reported commit target

Every action SHALL report the repository path it targeted, so a caller can confirm the target rather
than infer it. For commit and amend this SHALL be the verified work tree root. Preview SHALL remain
inert, so it SHALL report the path it would use without reading a filesystem or invoking Git.

#### Scenario: Preview names the path it would use

- **WHEN** the tool previews a message with a relative target
- **THEN** the result reports that target resolved against the session working directory
- **AND** the tool reads no filesystem entry and invokes no Git command

#### Scenario: Commit names its target

- **WHEN** a commit or amend succeeds
- **THEN** the result reports the repository root that received it

#### Scenario: Target resolves through a subdirectory

- **WHEN** the given `repo` is a subdirectory of a Git work tree
- **THEN** the reported root is the work tree root rather than the given subdirectory
