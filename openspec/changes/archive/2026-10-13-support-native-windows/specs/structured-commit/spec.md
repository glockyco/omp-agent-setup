## MODIFIED Requirements

### Requirement: Hook-preserving Git execution

For commit and amend, the tool SHALL write one temporary message file and invoke `git commit -F` or
`git commit --amend -F` in the target repository. The target SHALL be the optional `repo` input when
given, resolved against the session working directory when relative, and the session working directory
otherwise.

The tool SHALL reject a `repo` that does not exist, is not a directory, or is not inside a Git work
tree, and SHALL do so before writing a message file or invoking Git. This transport SHALL work with native Windows Git and filesystem paths as well as Linux/macOS, without requiring Nix or WSL, and SHALL keep repository hooks authoritative on every host.

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

#### Scenario: Native Windows repository and message paths contain spaces

- **WHEN** the tool commits or amends in a native Windows work tree with spaces in its path
- **THEN** Git receives one correctly addressed message file and target without shell interpolation
- **AND** the formatted message is preserved and the real Git hook runs

#### Scenario: Native Windows hook rejects a commit

- **WHEN** a native Windows repository's real Git hook rejects the proposed message
- **THEN** the tool reports Git's failure and creates no commit
- **AND** it does not bypass the hook, stage files, or retry through WSL
