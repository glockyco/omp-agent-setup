# omp-visual-feedback Specification

## Purpose
Provide local browser annotation of document and assistant-response snapshots without granting approval or changing source files.

## Requirements

### Requirement: Annotation command surface

The immutable plugin SHALL register `/plannotator-annotate <document>`, `/plannotator-last`, and `/plannotator-cancel`. Loading the plugin SHALL NOT require Plannotator. Invocation SHALL report a missing executable without installing software or selecting a fallback. The adapter SHALL expose no planning, approval, code-review, PR, or publishing command.

#### Scenario: Discover commands without the executable

- **WHEN** OMP loads the plugin with Plannotator absent
- **THEN** the three annotation commands and the existing commit capability remain available
- **AND** an annotation request reports the missing executable without starting a model turn

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

### Requirement: Current branch response selection

Last-response annotation SHALL select the latest completed assistant response with visible text on the active branch. Thinking, tool data, hidden messages, incomplete responses, and other branches SHALL be excluded. The snapshot identity SHALL identify the captured response, not a later response.

#### Scenario: Tool-assisted answer

- **WHEN** the branch contains private thinking, tool results, and a completed visible assistant answer
- **THEN** only the answer's visible text enters the snapshot

#### Scenario: No response exists

- **WHEN** no eligible response exists on the current branch
- **THEN** the command reports the condition and launches no review

### Requirement: Session-bound feedback

Non-empty submitted annotations SHALL enter the originating conversation exactly once as follow-up user feedback. The feedback SHALL preserve annotation text and identify the session, branch anchor, original source, and snapshot hash. Feedback received while OMP is busy SHALL wait rather than interrupt its current work. Changed or unavailable documents SHALL produce a stale-source warning. Navigation SHALL prevent delivery into the newly selected conversation.

#### Scenario: Submit during model work

- **WHEN** the browser submits annotations while OMP is busy
- **THEN** one follow-up message contains the annotations and captured source identity
- **AND** the adapter does not interpret annotations as authorization or apply file changes

#### Scenario: Source changes before submission

- **WHEN** the document changes or disappears during review
- **THEN** feedback identifies the reviewed snapshot and warns about the source change

#### Scenario: Navigate before a late result

- **WHEN** the user switches sessions or branches before the result arrives
- **THEN** the review is cancelled and the late result produces no feedback

### Requirement: Owned review lifecycle

Each session SHALL allow one pending review independently of other sessions. Commands SHALL return control while pending, and status SHALL identify the source and cancellation command. Dismissal, cancellation, navigation and shutdown SHALL release only the owned subprocess tree and private snapshot, preserving user history and preferences on Linux, macOS and Windows. Browser closure MAY leave a review pending, with `/plannotator-cancel` available without feedback.

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
- **AND** automatic browser-tab-close dismissal is not required

#### Scenario: Windows descendant survives the first termination request

- **WHEN** a native Windows review's owned tree has a surviving descendant after the bounded termination grace
- **THEN** cleanup force-terminates that owned descendant even if the original root has exited
- **AND** no unrelated or PID-reused process is terminated
- **AND** cleanup allows a bounded one-second termination grace before forcing surviving owned processes
- **AND** a root process exit alone does not establish tree cleanup
- **AND** cleanup waits for owned process/output closure before removing the private snapshot

#### Scenario: Historical parent PID refers to a newer process

- **WHEN** a Windows process predates an owned process but its recorded parent PID matches that owned process
- **THEN** cleanup does not adopt the older process or its descendants
- **AND** termination targets only creation-qualified owned identities, with descendants stopped before their surviving parents
- **AND** the operating system does not rebuild an unqualified process tree from a bare PID

#### Scenario: Repeated Windows cancellation races with feedback

- **WHEN** repeated cancellation and a late child result race in a native Windows session
- **THEN** tree termination settles once and no feedback reaches the conversation
- **AND** another session's active review remains available

#### Scenario: Owned process termination is denied

- **WHEN** the host denies termination or owned-tree inspection during cleanup
- **THEN** the adapter identifies the cleanup failure without delivering cancellation feedback or claiming resources were released
- **AND** cleanup failures are reported rather than presented as success

#### Scenario: Windows console requires force termination

- **WHEN** the non-force Windows tree request reports that a console process can only be terminated forcefully or that its child processes are still running
- **THEN** cleanup waits the bounded grace and force-terminates matching surviving owned identities
- **AND** other utility errors and access-denied remain visible rather than being treated as these expected refusal reasons

#### Scenario: Darwin group leader exits before the host reaps it

- **WHEN** cleanup receives a Darwin group permission refusal while its owned leader has exited but its host handle has not yet reaped it
- **THEN** cleanup retries only after that owned handle observes root exit
- **AND** an absent group is successful cleanup, but root exit alone does not establish that live descendants are gone
- **AND** a live-root or persistent live-group permission failure remains visible without deleting the private snapshot or delivering feedback

### Requirement: Annotation-only local subprocess

The adapter SHALL invoke only the stock `plannotator annotate <private snapshot.md> --json` CLI using an argument array and a host-supplied version-selected executable. It SHALL NOT require a downstream client-lease patch, gate mode, review timeout or fallback. Only non-empty `annotated` feedback SHALL reach OMP. Invocation SHALL require a local interactive TUI with UI availability on Linux, macOS or native Windows.

#### Scenario: Unexpected decision or process failure

- **WHEN** the child fails or emits malformed JSON or an unexpected decision
- **THEN** the adapter reports an error, cleans up owned resources, and injects no feedback
- **AND** unexpected decisions include `approved`
- **AND** `dismissed` and empty annotations instead produce notices without model turns

#### Scenario: Inherited remote or sharing settings

- **WHEN** a local interactive caller has Plannotator port, browser, or sharing overrides
- **THEN** the child still uses a random loopback port, the native browser, and no sharing or approval mode
- **AND** inherited Plannotator settings cannot enable sharing

#### Scenario: Remote or noninteractive invocation

- **WHEN** invocation occurs through SSH or a noninteractive OMP mode
- **THEN** it fails clearly before opening a review or publishing a listener

#### Scenario: Local Windows annotation commands

- **WHEN** the host executable is available and a local native Windows interactive TUI session invokes document or last-response annotation
- **THEN** the stock native browser review starts and non-empty submitted annotations return once to the originating conversation
- **AND** explicit cancellation remains available without requiring WSL or a Linux/macOS host
- **AND** diagnostics do not claim that only Linux/macOS are supported

#### Scenario: Every local and remote refusal applies on Windows

- **WHEN** a Windows caller lacks UI, uses a non-TUI mode, carries any SSH session marker, or requests explicit remote Plannotator invocation
- **THEN** the same corresponding local-interactive or remote refusal used on Linux/macOS appears before preparing a snapshot or spawning a child
- **AND** SSH markers and explicit remote invocation are refused identically on every OS

#### Scenario: Missing native host executable

- **WHEN** the local session's Plannotator executable cannot resolve
- **THEN** invocation identifies the missing host prerequisite without referring to a managed OMP wrapper
- **AND** loading the plugin still requires no executable installation
