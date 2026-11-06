# vault-access Specification

## Purpose
Give agents secrets from Bitwarden vaults through private files, with each entry approved once, so that secret values never reach the model provider or the saved session during normal work.

## Requirements

### Requirement: Value-free discovery and delivery

The `vault` tool SHALL search entries and deliver field values without placing a secret value in a tool argument or tool result. Search SHALL return entry names, entry ids, usernames, URIs and available field names, and no other field value. Delivery SHALL write the value to a new file under `~/.omp/vault/files/<vault>/` and return the file's path.

#### Scenario: Search entries

- **WHEN** the agent searches an unlocked vault
- **THEN** the result lists matching entry names, ids, usernames, URIs and field names
- **AND** it contains no password, TOTP secret, note or custom field value

#### Scenario: Tell entries with the same name apart

- **WHEN** two entries share a name, such as `github.com`
- **THEN** the search result shows each entry's username

#### Scenario: Deliver a field

- **WHEN** the agent requests an approved entry's field in `raw`, `dotenv` or `header` format
- **THEN** the file holds exactly the value, a `NAME=value` line or a `Name: value` line
- **AND** the tool result contains the path and a label but not the value
- **AND** the file is readable only by its owner on POSIX hosts

### Requirement: Redaction of delivered values

The extension SHALL replace every delivered value of at least six characters, except usernames, with the label `[vault:<vault>/<entry>/<field>]` in tool results, in the context sent to the model and in the final provider payload. It SHALL block a tool call whose arguments contain a redacted value. The set of redacted values SHALL be shared by all sessions in the OMP process and SHALL be reloaded from existing delivery files at session start.

#### Scenario: A command prints a delivered value

- **WHEN** a tool result contains a delivered password
- **THEN** the saved result and the next provider request contain the label instead

#### Scenario: A delivered username appears in output

- **WHEN** a tool result or a message contains a delivered username
- **THEN** it stays readable

#### Scenario: Resume later the same day

- **WHEN** a new OMP process starts while delivery files from earlier exist
- **THEN** the secret values in those files are redacted again without a vault unlock

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

### Requirement: Task-first vault discovery

The `vault` description SHALL begin with using passwords, API keys, tokens and TOTP codes for website, API and command-line sign-ins before asking for credentials. It SHALL distinguish personal and university accounts in `private` from SCCH accounts in `scch`, and state the SCCH network or FortiClient VPN requirement before explaining delivery mechanics. It SHALL explain how to obtain a replacement for a missing or expired delivery file and a fresh TOTP code without exposing a value.

#### Scenario: University sign-in blocks work

- **WHEN** an agent sees a sign-in page for a university account and reads the tool listing
- **THEN** the description directs it to search `private` before asking the person for credentials

#### Scenario: Delivered path no longer exists

- **WHEN** the agent's delivered file has expired or was removed by locking the vault
- **THEN** the description and delivery result direct it to call `file` again and use the new path

### Requirement: Actionable vault failures

Every vault failure SHALL state the failed condition and a specific safe next step. Rejected login credentials, master-password decryption failures and rejected or expired two-step codes SHALL be described as recoverable private input, not as an unusable vault. After the existing bounded unlock attempts are exhausted, the error SHALL state that another vault call prompts again. Secret values SHALL remain absent from errors.

#### Scenario: SCCH server cannot be reached

- **WHEN** a Bitwarden operation reports a network failure for `scch`
- **THEN** the error names the SCCH network or FortiClient VPN requirement and says to connect and retry or use `private` for personal and university accounts

#### Scenario: Master-password input does not decrypt the vault

- **WHEN** Bitwarden reports an invalid master password or a master-key decryption failure
- **THEN** the existing bounded unlock loop asks for private input again
- **AND** exhaustion says that a new vault call prompts again

#### Scenario: Two-step input is rejected

- **WHEN** Bitwarden rejects a two-step code as invalid or expired
- **THEN** the error says to retry the vault call and provide a fresh code through the private prompt
- **AND** it does not suggest an API key as a cure for a wrong two-step code

#### Scenario: Approval is denied or dismissed

- **WHEN** an entry approval is denied or its dialog is dismissed
- **THEN** the error distinguishes a saved denial from a closed dialog
- **AND** it preserves the denial and forbids bypassing approval
- **AND** it allows retrying an accidentally dismissed dialog without claiming a denial was saved

#### Scenario: Requested entry or field is missing

- **WHEN** an entry id is not found or a field is missing
- **THEN** the error directs the agent to search for the correct entry id or use an available field

#### Scenario: Interactive input is unavailable

- **WHEN** unlocking or approval requires a UI and the session has none
- **THEN** the error directs the agent to retry in an interactive OMP session and not request secrets in chat
