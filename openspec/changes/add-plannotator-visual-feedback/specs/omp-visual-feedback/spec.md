## Purpose

Provide local browser annotation of document and assistant-response snapshots without granting approval or changing source files.

## ADDED Requirements

### Requirement: Annotation command surface

The immutable plugin SHALL register `/plannotator-annotate <document>`, `/plannotator-last`, and `/plannotator-cancel`. Loading the plugin SHALL NOT require Plannotator. Invocation SHALL report a missing executable without installing software or selecting a fallback. The adapter SHALL expose no planning, approval, code-review, PR, or publishing command.

#### Scenario: Discover commands without the executable

- **WHEN** OMP loads the plugin with Plannotator absent
- **THEN** the three annotation commands and the existing commit capability remain available
- **AND** an annotation request reports the missing executable without starting a model turn

### Requirement: Immutable document snapshots

Document annotation SHALL accept UTF-8 text or Markdown files, including paths with spaces. Relative paths SHALL use the invoking session's working directory. `local://` SHALL use that session's native OMP mapping. The browser SHALL receive a private snapshot. Unsupported schemes, binary files, HTML files, directories, missing files, and unreadable files SHALL fail without substitution. Browser suggestions SHALL NOT modify the source.

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

Each session SHALL allow one pending review, while separate sessions SHALL operate independently. Annotation commands SHALL return control while the review is pending. Status SHALL identify the pending source and cancellation command. Dismissal, explicit cancellation, navigation, and shutdown SHALL release the owned process group and private snapshot without deleting user history or preferences. Browser closure SHALL return dismissal after the compatible executable's finite disconnect grace period, while a brief reconnect SHALL keep the review active.

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

#### Scenario: Close and reconnect

- **WHEN** the browser disconnects and reconnects within the documented grace period
- **THEN** the review remains active
- **AND** a sustained disconnect settles as dismissal without feedback

### Requirement: Annotation-only local subprocess

The adapter SHALL invoke only `plannotator annotate <private snapshot.md> --json` using an argument array. Only non-empty `annotated` feedback SHALL reach OMP. `dismissed` and empty annotations SHALL produce notices without model turns. Failed processes, malformed output, and unexpected decisions, including `approved`, SHALL report errors without feedback. Invocation SHALL require a local interactive OMP session. The child SHALL use random loopback ports and the platform-native browser, with sharing disabled regardless of inherited Plannotator settings.

#### Scenario: Unexpected decision or process failure

- **WHEN** the child fails or emits malformed JSON or an unexpected decision
- **THEN** the adapter reports an error, cleans up owned resources, and injects no feedback

#### Scenario: Inherited remote or sharing settings

- **WHEN** a local interactive caller has Plannotator port, browser, or sharing overrides
- **THEN** the child still uses a random loopback port, the native browser, and no sharing or approval mode

#### Scenario: Remote or noninteractive invocation

- **WHEN** invocation occurs through SSH or a noninteractive OMP mode
- **THEN** it fails clearly before opening a review or publishing a listener
