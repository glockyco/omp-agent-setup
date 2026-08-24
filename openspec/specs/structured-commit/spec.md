# structured-commit Specification

## Purpose
Define semantic commit guidance and structured commit transport that preserves repository hooks and never expands into repository-management policy.

## Requirements

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

### Requirement: Stable message formatting

The tool SHALL preserve paragraph boundaries, wrap ordinary prose to 72 columns, and SHALL NOT split URLs, code tokens, or other indivisible long tokens.

#### Scenario: Format multiple paragraphs

- **WHEN** the body contains two paragraphs and an overlong URL
- **THEN** ordinary words wrap, the blank line remains, and the URL remains intact

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

### Requirement: Repository authority

The tool SHALL NOT stage, push, pass `--no-verify`, validate repository-specific type or scope enums itself, invoke planning tools, or depend on `bunx`.

#### Scenario: Inspect transport side effects

- **WHEN** a commit succeeds
- **THEN** the only Git mutation requested by the tool is the requested commit or amend operation and repository hooks remain authoritative

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

### Requirement: Autonomous atomic checkpoints

During multi-step engineering work, the agent SHALL create an atomic commit after each coherent, verified unit of work, even when the user did not explicitly request a commit. It SHALL not wait for the complete change when an earlier unit already forms a truthful, independently useful checkpoint.

Before each commit, the agent SHALL stage only changes owned by the current task, inspect the staged diff, and use `personal_commit` for commit transport. Each commit SHALL contain one subject and leave applicable build and test checks passing.

#### Scenario: Complete one unit of a multi-step change

- **WHEN** one coherent unit has its specified behavior implemented and verified while later units remain
- **THEN** the agent stages only that unit's task-owned changes and creates an atomic commit
- **AND** it continues the remaining work from that checkpoint

#### Scenario: Work tree contains unrelated changes

- **WHEN** the agent reaches a commit checkpoint and the work tree also contains unrelated or user-owned changes
- **THEN** it excludes those changes from the staged commit
- **AND** it delays the checkpoint if it cannot separate ownership safely

### Requirement: Useful revision history

The agent SHALL preserve a completed checkpoint when a later correction or improvement is a distinct coherent unit. It SHALL create a new commit for that revision instead of amending the earlier checkpoint. It MAY amend when the user requests it or when the immediate commit does not yet represent a complete atomic action.

#### Scenario: Improve a completed checkpoint

- **WHEN** an earlier commit is a valid checkpoint and subsequent verified work improves or corrects it as a distinct unit
- **THEN** the agent records the revision in a new atomic commit
- **AND** the earlier checkpoint remains available for review and rollback

#### Scenario: Complete an incomplete immediate commit

- **WHEN** the most recent commit does not yet represent the intended atomic action and no later checkpoint depends on it
- **THEN** the agent may amend it with `personal_commit`

### Requirement: Explicit push authorization

The agent SHALL NOT push commits or tags unless the user explicitly requests the push. Autonomous staging and commits SHALL remain local so the user can review, revise, rebase, or roll them back before publication.

#### Scenario: Finish local implementation

- **WHEN** the agent completes and commits the requested local work without an explicit push request
- **THEN** the commits remain local and no remote reference changes

#### Scenario: User requests a push

- **WHEN** the user explicitly requests pushing the reviewed commits
- **THEN** the agent may push through the repository's ordinary Git workflow
