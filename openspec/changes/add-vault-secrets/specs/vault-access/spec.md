# Spec Delta

## ADDED Requirements

### Requirement: Value-free discovery and delivery

The `vault` tool SHALL search entries and deliver field values without placing a value in a tool argument or tool result. Search SHALL return entry names, entry ids and available field names only. Delivery SHALL write the value to a new file under `~/.omp/vault/files/<vault>/` and return the file's path.

#### Scenario: Search entries

- **WHEN** the agent searches an unlocked vault
- **THEN** the result lists matching entry names, ids and field names
- **AND** it contains no field value

#### Scenario: Deliver a field

- **WHEN** the agent requests an approved entry's field in `raw`, `dotenv` or `header` format
- **THEN** the file holds exactly the value, a `NAME=value` line or a `Name: value` line
- **AND** the tool result contains the path and a label but not the value
- **AND** the file is readable only by its owner on POSIX hosts

### Requirement: Redaction of delivered values

The extension SHALL replace every delivered value of at least six characters with the label `[vault:<vault>/<entry>/<field>]` in tool results, in the context sent to the model and in the final provider payload. It SHALL block a tool call whose arguments contain a delivered value. The set of delivered values SHALL be shared by all sessions in the OMP process and SHALL be reloaded from existing delivery files at session start.

#### Scenario: A command prints a delivered value

- **WHEN** a tool result contains a delivered value
- **THEN** the saved result and the next provider request contain the label instead

#### Scenario: Resume later the same day

- **WHEN** a new OMP process starts while delivery files from earlier exist
- **THEN** the values in those files are redacted again without a vault unlock

### Requirement: Private login and unlock

The extension SHALL obtain server, email, master password, two-step codes and API keys only through OMP dialogs, with masked input for secrets. It SHALL pass passwords and keys to `bw` through child-only environment variables, never through arguments. Each vault SHALL use its own `bw` data directory under `~/.omp/vault/bw/<vault>/`. Without an interactive UI the tool SHALL fail with an error instead of asking for credentials in chat.

#### Scenario: First login with two-step login

- **WHEN** a vault is used for the first time and the account requires a two-step code
- **THEN** the extension asks for email, master password and one code, which is a YubiKey OTP, an authenticator code, or empty to request an email code
- **AND** none of these reach the model, tool arguments or the saved session

#### Scenario: New-device verification

- **WHEN** the server still demands a code after a valid two-step login
- **THEN** the extension asks for the account's personal API key and logs in with it
- **AND** it unlocks with the master password afterwards

#### Scenario: Headless use

- **WHEN** the vault is locked and the session has no interactive UI
- **THEN** the tool fails with an error that names the missing UI

### Requirement: Unlock until midnight

The extension SHALL store the session key and its expiry, the next local midnight, in the OS keystore after an unlock and reuse it until then. Once the expiry has passed, the next use SHALL lock the vault, delete the cached key and delete the vault's delivery files before asking again.

#### Scenario: Reuse within the day

- **WHEN** a new OMP process uses an unlocked vault before midnight
- **THEN** no prompt appears

#### Scenario: Use after midnight

- **WHEN** a vault is used after its cache expired
- **THEN** the old delivery files are gone and the extension asks for the master password

### Requirement: Remembered entry approval

The first delivery from an entry SHALL ask with the choices allow always, allow once and deny, showing the entry name, the field and the agent's stated purpose. `always` and `deny` SHALL be remembered per vault and entry id in `~/.omp/vault/approvals.json`.

#### Scenario: Remembered allow

- **WHEN** an entry was allowed always
- **THEN** later deliveries from it do not ask

#### Scenario: Remembered deny

- **WHEN** an entry was denied
- **THEN** later deliveries fail without asking and without fetching the entry
