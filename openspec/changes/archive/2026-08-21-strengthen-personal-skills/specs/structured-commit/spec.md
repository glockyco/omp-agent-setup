## ADDED Requirements

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
