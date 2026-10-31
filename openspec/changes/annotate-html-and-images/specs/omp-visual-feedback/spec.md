## MODIFIED Requirements

### Requirement: Immutable document snapshots

Document annotation SHALL accept UTF-8 text or Markdown files, including paths with spaces, native Windows drive-qualified paths, and UNC paths. Relative paths SHALL use the invoking session's working directory. `local://` SHALL use that session's native OMP mapping. The browser SHALL receive a private snapshot. Unsupported schemes, other binary files, directories, missing files, and unreadable files SHALL fail without substitution. Browser suggestions SHALL NOT modify the source.

#### Scenario: Same local target in separate sessions

- **WHEN** two sessions request the same `local://` target with different mapped contents
- **THEN** each review displays its own session's snapshot and identifies its original target

#### Scenario: File path contains spaces

- **WHEN** the user requests an ordinary document whose path contains spaces
- **THEN** the full path selects one document without shell interpretation
- **AND** the source remains unchanged after feedback

#### Scenario: Unsupported target

- **WHEN** the target is a directory, a binary file that is not a supported image, an unsupported URL, or an unavailable document
- **THEN** the adapter reports the error and launches no review

#### Scenario: Native Windows absolute path

- **WHEN** a local Windows session requests an available UTF-8 document through a drive-qualified or UNC path containing spaces
- **THEN** that filesystem path selects the document rather than being rejected as a URL scheme
- **AND** the source remains unchanged

### Requirement: Session-bound feedback

Non-empty submitted annotations SHALL enter the originating conversation exactly once as follow-up user feedback. The feedback SHALL preserve annotation text and identify the session, branch anchor, original source, and snapshot hash. Feedback received while OMP is busy SHALL wait rather than interrupt its current work. Changed or unavailable documents or copied files SHALL produce a stale-source warning. Navigation SHALL prevent delivery into the newly selected conversation.

#### Scenario: Submit during model work

- **WHEN** the browser submits annotations while OMP is busy
- **THEN** one follow-up message contains the annotations and captured source identity
- **AND** the adapter does not interpret annotations as authorization or apply file changes

#### Scenario: Source changes before submission

- **WHEN** the document changes or disappears during review
- **THEN** feedback identifies the reviewed snapshot and warns about the source change

#### Scenario: Copied file changes before submission

- **WHEN** a copied image or page asset changes or disappears, or a file is added to a copied page folder, during review
- **THEN** feedback identifies the reviewed snapshot and warns about the source change

#### Scenario: Navigate before a late result

- **WHEN** the user switches sessions or branches before the result arrives
- **THEN** the review is cancelled and the late result produces no feedback

### Requirement: Annotation-only local subprocess

The adapter SHALL invoke only the stock `plannotator annotate <private snapshot document> --json` CLI using an argument array and a host-supplied version-selected executable. It SHALL NOT require a downstream client-lease patch, gate mode, review timeout or fallback. Only non-empty `annotated` feedback that does not report nothing to send SHALL reach OMP. Invocation SHALL require a local interactive TUI with UI availability on Linux, macOS or native Windows.

#### Scenario: Unexpected decision or process failure

- **WHEN** the child fails or emits malformed JSON or an unexpected decision
- **THEN** the adapter reports an error, cleans up owned resources, and injects no feedback
- **AND** unexpected decisions include `approved`
- **AND** `dismissed`, empty annotations and decisions that report nothing to send instead produce notices without model turns

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

## ADDED Requirements

### Requirement: Pages and images

Document annotation SHALL also accept HTML pages and images. A page snapshot SHALL copy the page's folder up to a size bound. An image snapshot SHALL show a copy of the image as the only content of a generated Markdown document. A text or Markdown snapshot SHALL copy the local images the document references by relative path, keeping their relative layout. Snapshot files SHALL be private to the user. Feedback SHALL name what the snapshot copied.

#### Scenario: Page with local assets

- **WHEN** the user annotates an `.html` or `.htm` page whose styles, scripts and images sit beside it or in folders below it
- **THEN** the review renders the page with those files from the private copy
- **AND** the source folder remains unchanged after feedback

#### Scenario: Page folder over the bound

- **WHEN** the page's folder holds more than the size bound
- **THEN** the adapter names the bound, suggests a folder of the page's own, and launches no review

#### Scenario: Image target

- **WHEN** the user annotates a PNG, JPEG, GIF, WebP, SVG, BMP, ICO or AVIF file
- **THEN** the review shows a copy of the image as the only content of a Markdown document
- **AND** feedback identifies the original image file

#### Scenario: Markdown with relative images

- **WHEN** a text or Markdown document references local images by relative paths, including paths above its own folder
- **THEN** the review shows those images from the private copy
- **AND** URLs, data URIs and absolute paths are not copied
