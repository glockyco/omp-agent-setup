# Spec Delta

## Purpose

Provide approved Bitwarden fields for local CLI operations and browser logins with value-free tool arguments and protection against accidental disclosure in OMP history and provider requests.

## ADDED Requirements

### Requirement: Independent vault profiles

The extension SHALL maintain separate `scch` and `private` profiles, each bound to one HTTPS server and account in its own Bitwarden data directory. It SHALL configure servers itself and SHALL NOT require a pre-exported session key or workstation-created configuration.

#### Scenario: First private login

- **WHEN** the private vault has no server selection
- **THEN** a masked local prompt asks for its US or EU cloud server before requesting credentials
- **AND** the SCCH server and account remain independent

#### Scenario: Missing executable

- **WHEN** official `bw` is absent from PATH
- **THEN** vault use reports the missing prerequisite without installing a substitute
- **AND** other plugin capabilities remain usable

### Requirement: Private authentication input

Server selection, email, master password and verification codes SHALL be collected through masked local prompts. Prompt values and raw CLI transcripts SHALL NOT be returned to tools, logged or appended to sessions. Cancellation, unavailable UI and unsupported authentication challenges SHALL fail without revealing their input.

#### Scenario: Login or unlock

- **WHEN** a locked vault is needed
- **THEN** the extension performs login or unlock using private child input and returns fixed status metadata
- **AND** no manual terminal unlock or composer-pasted password is required

#### Scenario: New-device email OTP

- **WHEN** Bitwarden requests new-device verification
- **THEN** the extension privately answers that recognized challenge rather than treating an ordinary 2FA option as equivalent
- **AND** an unsupported dialogue terminates without forwarding its transcript

### Requirement: End-of-day OS-protected unlock

Unlock keys SHALL be cached using the current account's OS keystore until the next local midnight and bound to server and account identity. Master passwords and OTPs SHALL NOT be cached. Expired, corrupt or mismatched keys SHALL be refused. An unavailable keystore SHALL NOT cause plaintext fallback storage.

#### Scenario: Same-day reuse

- **WHEN** another local OMP session requests the same profile before expiry
- **THEN** it can reuse the protected key without a new master-password prompt
- **AND** generic shell and eval tools remain usable

#### Scenario: Expiry

- **WHEN** midnight passes in a running process or an expired envelope is found at startup
- **THEN** delivery authority is revoked, protected delivery files are removed and the profile is locked
- **AND** no expired key is used to satisfy a new operation

### Requirement: Remembered entry approval

Before granting field access, the extension SHALL offer `always`, `once` and `deny` for the entry. Persistent decisions SHALL bind server, account and exact entry identity, not entry name. One-time permission SHALL cover one delivery operation. Approval storage SHALL contain no field values.

#### Scenario: Approve or deny

- **WHEN** an entry is first selected
- **THEN** a local prompt identifies the vault, entry and requested fields
- **AND** `always` avoids repeated entry prompts until revoked
- **AND** `once` expires after delivery or cancellation
- **AND** `deny` remains effective until changed locally

### Requirement: Names-only discovery and references

Search and listing SHALL return only names and opaque selection identifiers, not usernames, URLs, notes, passwords, custom values or raw item JSON. Field requests SHALL return random opaque references rather than plaintext. A reference SHALL NOT encode a credential-derived value.

#### Scenario: Select a field

- **WHEN** an agent selects one of several matching entries and requests a field
- **THEN** the model receives only names, opaque identifiers and the approved reference
- **AND** duplicate names do not require exposing other fields

### Requirement: Value-free delivery arguments

The extension SHALL resolve field references only inside execution, never by replacing persisted model-authored tool-call input with plaintext. It SHALL support child-only environment variables, protected files, HTTP headers and dotenv lines. Tool results for its own private operations SHALL contain scrubbed output or fixed metadata only.

#### Scenario: CLI environment and files

- **WHEN** an agent requests a command with environment or file bindings
- **THEN** the original arguments contain references, variable names and paths only
- **AND** the child receives actual values without changing the parent environment
- **AND** private stdout, stderr and failures are scrubbed before publication or artifact creation

#### Scenario: Reusable protected file

- **WHEN** an agent asks for a field, header or dotenv file
- **THEN** it receives an owner-protected file path, not the file's contents
- **AND** it can use the path with ordinary CLI or eval tools
- **AND** the file is removed on lock or expiry

### Requirement: Browser fill without plaintext history

The extension SHALL support browser fills in Tern by resolving opaque references inside the browser tool's execution and delegating to the native browser implementation. Model-authored browser arguments SHALL remain value-free. The delegated result, details, errors and updates SHALL be sanitized before returning through the extension.

#### Scenario: Fill login controls

- **WHEN** browser fill arguments contain approved references for username or password
- **THEN** private execution supplies actual values to the native browser without rewriting the persisted call
- **AND** browser login remains usable alongside normal bash and eval
- **AND** unsupported delegation fails without placing values into eval source as a fallback

### Requirement: Accidental echo scrubbing

The extension SHALL replace known literal values in tool-result content and details, per-request context and final provider payload text. Scrubbers SHALL use an already-loaded value set without I/O. The design SHALL disclose failure, streaming, binary and unhooked-path limitations rather than claim sandbox protection or universally fail-closed hooks.

#### Scenario: Echo or error

- **WHEN** a command accidentally echoes a registered canary in supported text output or an error
- **THEN** its normal tool result, provider replay and persisted final result contain a non-value marker instead
- **AND** the extension's own commands never publish unsanitized progress or artifacts

#### Scenario: Unsupported output shape

- **WHEN** a supported extension-owned operation would return a binary or image containing private data
- **THEN** that operation suppresses the output rather than trying to redact pixels
- **AND** documented limitations identify generic image and pre-hook artifact paths separately

### Requirement: Redaction continuity on resume

Before delivering a value, the extension SHALL durably protect its session redaction record with the OS keystore. Fresh processes SHALL restore that record before admitting provider use of the affected session. Locking a vault SHALL NOT discard the redaction information required for old history. Missing or unreadable records SHALL not silently disable scrubbing.

#### Scenario: Resume after lock or rotation

- **WHEN** a session resumes after its vault locks or an entry value changes
- **THEN** the old delivered value remains available privately for redaction without being returned as entry access
- **AND** references require fresh authority before new delivery

#### Scenario: Unreadable registry

- **WHEN** the required encrypted record cannot be loaded
- **THEN** the extension uses supported admission cancellation before continuing the affected session
- **AND** it requests private recovery rather than returning unchanged context as if protection succeeded
- **AND** unsupported cancellation paths are identified as limitations and are not represented as a universal provider veto

### Requirement: Safe lifecycle inputs

Compaction, snapcompact, handoff, advisors, subagents and sharing SHALL consume scrubbed session text and value-free tool arguments during supported operation. Child sessions SHALL inherit redaction coverage or restore the required record before vault use. No blanket restriction on generic tools SHALL be introduced merely because an unlock cache or delivery file exists.

#### Scenario: Maintenance delegation and share

- **WHEN** a vault-using session is compacted, resumed, handed off, delegated or exported
- **THEN** behavior tests inspect actual inputs and resulting history for canary disclosure
- **AND** no runtime path is declared covered merely because one foreground hook ran
- **AND** uncovered paths and their available cancellation behavior are reported explicitly

### Requirement: Extension-owned state and recovery

Profiles, approval decisions, protected caches, redaction records and delivery files SHALL stay in extension-owned private state outside the plugin payload. State writes SHALL preserve unrelated OMP settings and sessions. Concurrent mutations and crash recovery SHALL not expose plaintext files through unsafe permissions or ownership confusion.

#### Scenario: Concurrent access and cleanup

- **WHEN** processes share a profile or delivery is interrupted
- **THEN** serialized updates preserve account bindings and approvals
- **AND** startup cleanup removes only owned expired resources
- **AND** ownership or permission failures stop the affected delivery rather than create a public file

### Requirement: Canary acceptance before real entries

The feature SHALL have behavior tests using a stub CLI and non-pattern canaries plus real OMP payload, persistence and resume tests. Real-host acceptance SHALL use throwaway entries in both vaults on Windows and macOS before any real entry is used. Residual risks SHALL remain explicit in acceptance evidence.

#### Scenario: Detect an actual leak

- **WHEN** tests exercise login, delivery, accidental echo, browser fill and lifecycle paths
- **THEN** captured provider payloads, session files and exported artifacts are checked for raw canary values
- **AND** deliberate raw-value injection proves the detectors can fail
- **AND** hook failure and pre-hook output tests distinguish protected behavior from accepted residual risk
