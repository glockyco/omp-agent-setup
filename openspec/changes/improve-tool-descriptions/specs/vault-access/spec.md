# Spec Delta

## ADDED Requirements

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
