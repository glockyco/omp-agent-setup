# Design

## Threat model

The extension prevents accidental disclosure during normal agent work: a secret value must not reach the model provider or the saved session. It is not a sandbox. Code that runs as the same user can read the delivery files and the keystore, as it can read git credentials, SSH keys and browser cookies today. Per-entry approval keeps an agent from fetching entries the person never allowed. Generic tools such as bash, eval and the browser stay fully usable.

## Source facts (OMP v18.14.0)

- A `tool_call` handler that revises the input changes what OMP displays, saves and executes. Substituting plaintext into tool arguments would therefore save the value in the session. The extension never does that.
- A `tool_result` patch replaces the content that OMP saves.
- The extension `context` hook runs before OMP's provider transforms, including snapcompact, which can turn text into images. `before_provider_request` sees the final payload.
- These hooks do not block a request when a handler throws or times out. The scrubbers are therefore plain synchronous string replacement with no I/O.
- Extensions cannot add values to OMP's own secret obfuscator after startup.

## Decisions

### One tool, file delivery

The `vault` tool has three actions. `search` returns entry names, ids and the names of available fields, never values. `file` writes one field of one entry to a new file under `~/.omp/vault/files/` and returns its path. `lock` locks the vault and deletes its files.

The agent uses the path without reading the value into its context: `--passwordfile <path>`, `$(cat <path>)`, `curl -H @<path>`, a dotenv loader, or `await tab.fill(selector, await Bun.file(path).text())` in an eval cell for browser logins. Tool arguments contain only paths. The `file` action writes the exact field value (`raw`), a `NAME=value` line (`dotenv`) or a `Name: value` line (`header`).

A wrapper that executes commands with injected environment variables, or an override of the browser tool, would avoid the file but needs a second process runner or a copy of the browser tool's schema. Files cover the same cases with less code.

### Redaction

The extension keeps every value it delivered in one process-wide set, shared across subagent sessions in the same process. Values shorter than six characters are not redacted, because replacing them would corrupt unrelated output. `tool_result`, `context` and `before_provider_request` replace each known value with `[vault:<vault>/<entry>/<field>]`. A `tool_call` guard blocks a call whose arguments contain a known value.

Because tool results are cleaned before OMP saves them, a resumed session contains no values. At session start the extension reloads the values of today's delivery files, so a command that prints one later in the day is still redacted. Remaining gaps, when a hook fails or a tool writes output before its result hook runs, are listed as residual risks.

### Login and unlock

Each vault has its own `bw` data directory, `~/.omp/vault/bw/<vault>/`, selected with `BITWARDENCLI_APPDATA_DIR`. The `scch` vault uses `https://password.scch.at`. The first login to any other vault asks for its server through a selection: Bitwarden US, Bitwarden EU or a custom URL.

When a vault is needed and not unlocked, the extension asks through masked OMP prompts. Login asks for the email and master password, then for a two-step code when the server demands one. If the server demands new-device verification, which `bw` cannot complete without a terminal, the extension asks for the account's personal API key and logs in with `--apikey`. Unlock asks for the master password. Passwords reach `bw` through a child-only environment variable named in `--passwordenv`, never through arguments. Without an interactive UI the tool returns an error that names the missing UI instead of asking for credentials in chat.

### Unlock cache until midnight

After an unlock the session key and its expiry, the next local midnight, are stored in the OS keystore: a CurrentUser DPAPI file under `~/.omp/vault/cache/` on Windows, written and read through PowerShell's `ConvertFrom-SecureString`, and the login Keychain on macOS through `security`. The key reaches both tools over stdin. Each use checks the expiry. An expired cache runs `bw lock` and deletes the cache and the vault's delivery files.

### Approval

The first `file` request for an entry shows the entry name, the field and the agent's stated purpose, with the choices allow always, allow once and deny. `always` and `deny` are stored in `~/.omp/vault/approvals.json`, keyed by vault and entry id.

## State

| Path | Contents |
| --- | --- |
| `~/.omp/vault/profiles.json` | Server URL per vault. |
| `~/.omp/vault/bw/<vault>/` | The vault's `bw` data directory. |
| `~/.omp/vault/approvals.json` | Remembered entry decisions. |
| `~/.omp/vault/cache/<vault>.dpapi` | Windows unlock cache. macOS uses the Keychain. |
| `~/.omp/vault/files/<vault>/` | Delivery files and their labels, deleted at lock or expiry. |

Directories are created with mode 0700 and files with 0600 on POSIX. On Windows the user profile's default ACL applies.

## Residual risks

- A hook that throws or times out lets its text through unredacted.
- Tools that write output to an artifact before their result hook runs, such as large bash output, can keep a value on disk. The model sees the redacted result.
- Values in images, screenshots or encodings such as base64 are not recognized.
- `/share` exports saved history, which is clean unless one of the gaps above applied.

## Verification

Unit tests drive the extension with a stub `bw`, an in-memory keystore, a fixed clock and a temporary home. They cover login, two-step login, the API-key fallback, unlock, caching and expiry at midnight, approval choices, the three file formats byte for byte, redaction in all four hooks and the guard. Integration tests check the real keystore round trip on Windows and macOS. Before real items, throwaway canary entries in both vaults go through login, delivery, a command that echoes the value, a browser fill and a restart in a real Tern session.
