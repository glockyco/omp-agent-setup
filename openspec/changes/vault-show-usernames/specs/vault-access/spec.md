## MODIFIED Requirements

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
