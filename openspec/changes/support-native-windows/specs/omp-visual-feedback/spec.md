## MODIFIED Requirements

### Requirement: Immutable document snapshots

Document annotation SHALL accept UTF-8 text or Markdown files, including paths with spaces, native Windows drive-qualified paths, and UNC paths. Relative paths SHALL use the invoking session's working directory. `local://` SHALL use that session's native OMP mapping. The browser SHALL receive a private snapshot. Unsupported schemes, binary files, HTML files, directories, missing files, and unreadable files SHALL fail without substitution. Browser suggestions SHALL NOT modify the source.

#### Scenario: Same local target in separate sessions

- **WHEN** two sessions request the same `local://` target with different mapped contents
- **THEN** each review displays its own session's snapshot and identifies its original target

#### Scenario: File path contains spaces

- **WHEN** the user requests an ordinary document whose path contains spaces
- **THEN** the full path selects one document without shell interpretation
- **AND** the source remains unchanged after feedback

#### Scenario: Unsupported target

- **WHEN** the target is a directory, binary file, HTML file, unsupported URL, or unavailable document
- **THEN** the adapter reports the error and launches no review

#### Scenario: Native Windows absolute path

- **WHEN** a local Windows session requests an available UTF-8 document through a drive-qualified or UNC path containing spaces
- **THEN** that filesystem path selects the document rather than being rejected as a URL scheme
- **AND** the source remains unchanged

### Requirement: Owned review lifecycle

Each session SHALL allow one pending review, while separate sessions SHALL operate independently. Annotation commands SHALL return control while the review is pending. Status SHALL identify the pending source and cancellation command. Dismissal, explicit cancellation, navigation, and shutdown SHALL release the owned subprocess tree and private snapshot without deleting user history or preferences on Linux, macOS, and native Windows. Browser closure MAY leave a review pending. `/plannotator-cancel` SHALL remain available to release that review without feedback. Automatic browser-tab-close dismissal SHALL NOT be required. Cleanup SHALL allow a bounded one-second termination grace before forcing surviving owned processes and SHALL NOT stop another review or an unrelated process. A root process exit alone SHALL NOT establish tree cleanup; cleanup failures SHALL be reported rather than presented as success.

#### Scenario: Cancel one concurrent review

- **WHEN** two sessions have active reviews and one runs `/plannotator-cancel`
- **THEN** only that session's process, listener, and private snapshot are released
- **AND** neither cancellation nor a duplicate result enters model context

#### Scenario: Request a second review

- **WHEN** a session already has a pending review
- **THEN** the request identifies the existing review and the cancellation command without replacing it

#### Scenario: Browser never connects

- **WHEN** the browser does not open after the child starts
- **THEN** the command interface remains available and explicit cancellation releases the review

#### Scenario: Cancel after browser closure

- **WHEN** a closed browser tab leaves the review pending and the user runs `/plannotator-cancel`
- **THEN** the adapter releases the owned process, listener, and private snapshot
- **AND** cancellation produces no feedback or model turn

#### Scenario: Windows descendant survives the first termination request

- **WHEN** a native Windows review's owned tree has a surviving descendant after the bounded termination grace
- **THEN** cleanup force-terminates that owned descendant even if the original root has exited
- **AND** no unrelated or PID-reused process is terminated
- **AND** cleanup waits for owned process/output closure before removing the private snapshot

#### Scenario: Repeated Windows cancellation races with feedback

- **WHEN** repeated cancellation and a late child result race in a native Windows session
- **THEN** tree termination settles once and no feedback reaches the conversation
- **AND** another session's active review remains available

#### Scenario: Owned process termination is denied

- **WHEN** the host denies termination or owned-tree inspection during cleanup
- **THEN** the adapter identifies the cleanup failure without delivering cancellation feedback or claiming resources were released

### Requirement: Annotation-only local subprocess

The adapter SHALL invoke only the stock `plannotator annotate <private snapshot.md> --json` CLI using an argument array. The host SHALL supply the version-selected vendor executable. The adapter SHALL NOT require a downstream client-lease patch, gate mode, review timeout, or fallback. Only non-empty `annotated` feedback SHALL reach OMP. `dismissed` and empty annotations SHALL produce notices without model turns. Failed processes, malformed output, and unexpected decisions, including `approved`, SHALL report errors without feedback. Invocation SHALL require a local interactive OMP TUI session with UI availability on Linux, macOS, or native Windows; diagnostics SHALL NOT claim that only Linux/macOS are supported. SSH markers and explicit remote Plannotator invocation SHALL be refused identically on every OS before review launch. The child SHALL use random loopback ports and the platform-native browser, with sharing disabled regardless of inherited Plannotator settings.

#### Scenario: Unexpected decision or process failure

- **WHEN** the child fails or emits malformed JSON or an unexpected decision
- **THEN** the adapter reports an error, cleans up owned resources, and injects no feedback

#### Scenario: Inherited remote or sharing settings

- **WHEN** a local interactive caller has Plannotator port, browser, or sharing overrides
- **THEN** the child still uses a random loopback port, the native browser, and no sharing or approval mode

#### Scenario: Remote or noninteractive invocation

- **WHEN** invocation occurs through SSH or a noninteractive OMP mode
- **THEN** it fails clearly before opening a review or publishing a listener

#### Scenario: Local Windows annotation commands

- **WHEN** the host executable is available and a local native Windows interactive TUI session invokes document or last-response annotation
- **THEN** the stock native browser review starts and non-empty submitted annotations return once to the originating conversation
- **AND** explicit cancellation remains available without requiring WSL or a Linux/macOS host

#### Scenario: Every local and remote refusal applies on Windows

- **WHEN** a Windows caller lacks UI, uses a non-TUI mode, carries any SSH session marker, or requests explicit remote Plannotator invocation
- **THEN** the same corresponding local-interactive or remote refusal used on Linux/macOS appears before preparing a snapshot or spawning a child

#### Scenario: Missing native host executable

- **WHEN** the local session's Plannotator executable cannot resolve
- **THEN** invocation identifies the missing host prerequisite without referring to a managed OMP wrapper
- **AND** loading the plugin still requires no executable installation
