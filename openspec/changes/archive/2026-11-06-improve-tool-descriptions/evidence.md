# Tool usability evidence

## Scope and method

Audited on 2026-11-06 against [Anthropic, Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents). `plugin/extensions/` contains two `registerTool` calls: `vault` and `personal_commit`. This change includes one-off reading trials, not an evaluation service or standing skill-activation check. No real credentials were requested for these trials.

## Description openings

Vault before:

> Use secrets from Bitwarden vaults without seeing them. Vaults: scch (SCCH Vaultwarden) and private.

Vault after:

> Log in to websites, APIs and command-line tools with the passwords, API keys, tokens and TOTP codes stored in your Bitwarden vaults, without seeing them: `private` (personal and university accounts, such as aau.at) and `scch` (SCCH accounts, reachable only on the SCCH network or FortiClient VPN). Use it whenever a sign-in page, a password prompt or a missing token blocks work, before asking the person.

Personal Commit before and after, unchanged:

> Preview, create, or amend a Conventional Commit from separate subject and causal body fields. Does not stage or push.

## Audit

| Tool | When to use and implicit context | Parameters | Errors and response signal | Evidence and decision |
| --- | --- | --- | --- | --- |
| `vault` | The old opening named a secret-delivery mechanism, not sign-in blockers. It omitted account ownership and SCCH network access. The new opening supplies those facts before delivery mechanics. | Action enum and action-prefixed field descriptions identify search, returned entry ids, field names and output formats. Trials selected the correct vault, field, format and environment variable name without renaming parameters. | Errors now state a next step. Denial and dismissal differ. Search stays capped at 25 entries. File results stay value-free and add replacement-path guidance. | The Google sign-in session missed vault use until prompted. The decryption session handed deployment back after a probable typo. Final trials chose private university credentials and a replacement dotenv file. |
| `personal_commit` | Its action-first opening identifies preview, commit and amend, its causal body and its staging/push boundary. Both final trials selected it correctly. | `action` is an enum. `repo` explains relative resolution and its default. `body` explicitly gives the reason, not who asked. `subject` has no separate description, but both trials produced valid Conventional Commit subjects. | Input errors state required types, subject syntax, length and causal-body requirements. Repository errors identify the offending path. Git failures retain authoritative hook diagnostics. Results identify the target and return the formatted message or Git result. | Final trials chose the correct action and repository and wrote causal bodies without citing the request. No missed or misused behavior was observed, so this tool and its pinned structured-commit specification remain unchanged. |

No README additions were needed. Tool usage stays in the registered descriptions. Required behavior stays in the vault spec delta and this change holds the evidence.

## Session search

The mechanical scan parsed actual `toolResult` rows with `details.xdev.tool == "vault"` or `toolName == "vault"`, not textual mentions in prompts or source snippets. It inspected 3,031 Mac JSONL files and 1,136 Korolev JSONL files. All Korolev files were readable using shared-read handles. The Mac scan found 103 saved results, including historical replay copies, which reduce to 61 unique timestamp/arguments/result records and six distinct errors. Korolev had 15 results, 12 successes and three errors. The matching Korolev source sessions were copied into `~/.omp/agent/korolev-sessions/` for historical consultation.

Positive controls were the successful Mac `private` search for `signing` at 2026-11-04 15:04:17 UTC and the successful Korolev `scch` search for `omp canary` at 2026-10-30 11:52:33 UTC. The remote scan initially used Windows PowerShell rather than PowerShell 7, so its zero-result output was discarded and the scan was rerun with `pwsh`. An initial assistant scan also failed to pair calls and was discarded.

The dates below are raw JSONL event timestamps, not today's reminder injected into a historical consultation. Conclusions come from `seance` consultations. For pre-compaction events, the consultation read the original rows rather than treating an absent event in its compacted fork as proof of absence.

| Host, event date UTC | Session id | Error or missed behavior | Observed response and new steering |
| --- | --- | --- | --- |
| Mac, 2026-11-02 09:29 to 09:33 | `01a19b41-e2a4-72e1-b108-ee84249c24d4` | At the Google sign-in page the agent said it should not sign in with credentials on the person's behalf. The person replied, "You can just sign in yourself?" The later password request returned `The request was denied.` at 09:32:18. | The agent did not retry the denial and offered sign-in choices. The person then said "Signed in." No accidental denial was established. The new opening would select vault use before handing sign-in back, while the new approval messages preserve a refusal and distinguish a dismissed dialog. |
| Mac, 2026-11-04 15:03:37 | `01a1a110-902a-735d-9d12-a087ba4c49d4` | `Unlock failed: ERROR bitwarden_crypto::keys::master_key: error=The decryption operation failed` | The agent offered either unlocking the vault or having the person run deployment manually. At 15:03:56 the person said, "Please try again - I probably just had some typo." The retry succeeded at 15:04:17. This is the confirmed probable-mistype case. The agent did not literally call the vault unfixable, but it prematurely handed deployment back instead of treating the private input as recoverable. The existing bounded retry loop now recognizes that decryption diagnostic, and exhaustion explicitly says the next call prompts again. |
| Korolev, 2026-10-30 12:07:10 and 12:08:38 | `01a18ca2-5c0f-7280-a163-25567b1a2d37` | `Login failed: Two-step token is invalid. Try again.` then `Login cancelled.` | The task explicitly said report and stop. The agent stopped, retried when asked and stopped after the cancelled prompt. No user-confirmed typo or permanent-block conclusion appears. New messages identify rejected/expired input or cancellation and say that a new call opens private prompts. |
| Korolev, 2026-10-30 13:16:47 | `01a18cf0-a1f0-760d-9cc9-3aac5a2b7a90` | `The request was denied.` for SCCH entry notes | The agent could not tell a deliberate denial from an unanswered prompt. It stopped the requested test and suggested approval on retry. No user explanation establishes which occurred. The new messages distinguish a saved Deny from a dismissed dialog and forbid bypassing approval. |
| Mac, 2026-11-01 12:10:29 | `01a19419-7dda-71b2-b01c-20cb2f0fba02` | `The call contains a vault value. Pass the delivered file path instead.` | A username in the purpose matched a redacted delivered username. The agent selected the wrong account before the person corrected it. The existing username/URI discovery fix already keeps usernames readable. The guard remains unchanged and still gives the correct path-based next step for actual secret values. |
| Mac, 2026-11-01 13:27:58 | `01a19419-7dda-71b2-b01c-20cb2f0fba02` | `The request was denied.` for a Cloudflare username | The person interrupted and said to fix the tool first. No saved approval file existed. After the tool fix the agent requested the entry again and succeeded. The new dismissed-dialog message permits a fresh request without claiming a denial was saved. A real Deny remains authoritative. |
| Mac, 2026-11-06 11:43:55 | `01a1b073-5717-755a-9e86-7ee71a47bb26` | `Login failed: Unable to fetch ServerConfig from https://password.scch.at/api FetchError: request to https://password.scch.at/api/config failed, reason: getaddrinfo ENOTFOUND password.scch.at` | The agent searched both vaults for AAU. The private search succeeded and it continued there. The new opening directs university accounts to private, and the network error explains when SCCH can be reached rather than suggesting the entry or vault is missing. |
| Mac, 2026-11-06 12:58:37 | `01a1afe2-3468-7365-bb89-c9627127b750` | The same SCCH ENOTFOUND error during a repeated AAU search | This is a mechanically confirmed repeat, not an independently consulted historical conclusion. The same SCCH network/private-account guidance applies. |

There was no vault-tool error for an expired delivered path in these extracted results. In the 2026-11-01 session the agent noticed that locking had deleted a file and requested it again. Missing consumed files fail in the consumer, not inside `vault`, so the description and delivery result now explicitly say to obtain a new file. File lifetime does not extend the validity of a TOTP code.

## Error messages before and after

`D` below means the redacted first diagnostic line from Bitwarden, retained for diagnosis. `V`, `F`, `N` and `S` stand for the actual vault, format, field/name and status. Each row records the full new message or its interpolated template. All existing Bitwarden nonzero-result paths use the shared diagnostic-family guidance before falling back to the operation-specific message.

| Path | Before | After |
| --- | --- | --- |
| Missing format name | `format F needs a name` | `format F needs a name. Set name to the variable or header name, or use format raw.` |
| Invalid dotenv name | `dotenv name must be a valid variable name` | `dotenv name must be a valid variable name. Use letters, digits and underscores, starting with a letter or underscore.` |
| Invalid header name | `header name must be a valid HTTP header name` | `header name must be a valid HTTP header name. Use a name such as Authorization or X-Api-Key.` |
| Multiline header value | `the value contains a line break and cannot be a header` | `the value contains a line break and cannot be a header. Use format raw or dotenv instead.` |
| List failure | `bw list failed: D` | `bw list failed: D` followed by `Retry the search. If it still fails, check the Bitwarden CLI's reported error before continuing.` |
| Remembered denial | `This entry is denied for agents.` | `This entry is denied for agents. Do not retry or edit approvals to bypass that decision. Use another approved entry, or ask the person to change the approval.` |
| Entry fetch failure, including missing id | `bw get failed: D` | `bw get failed: D` followed by `Run vault action search in V and use an entry id from its result.` |
| Malformed entry | `bw returned an entry without id or name.` | `bw returned an entry without id or name. Run vault action search again and use a returned entry id. If the entry is still malformed, repair it in Bitwarden before retrying.` |
| Approval without UI | `Approving this entry needs an interactive OMP session.` | `Approving this entry needs an interactive OMP session. Retry this file request there so the person can approve it. Do not ask for the secret in chat.` |
| Explicit Deny | `The request was denied.` | `The request was denied and that decision is saved. Do not retry or edit approvals to bypass it. Use another approved entry, or ask the person to change the approval.` |
| Dismissed approval | `The request was denied.` | `The approval dialog was closed without allowing access. If it was dismissed accidentally, retry this vault call to ask again. Do not use the entry without approval.` |
| Invalid vault name | `vault names are lowercase words such as scch` | `vault names are lowercase words such as scch or private. Set vault to the intended vault name and retry.` |
| Unlock without UI | `The V vault is S, and unlocking it needs an interactive OMP session.` | `The V vault is S, and unlocking it needs an interactive OMP session. Retry this vault call there to get private login prompts. Do not ask for credentials in chat.` |
| Sync failure | `bw sync failed: D` | `bw sync failed: D` followed by `Retry this vault call to sync again. If it still fails, resolve the reported Bitwarden sync error before using entries.` |
| Status failure | `bw status failed: D` | `bw status failed: D` followed by `Check that bw works on this host, then retry this vault call.` |
| Unknown status | `bw reported an unknown status: S` | `bw reported an unknown status: S. Check or update the Bitwarden CLI on this host, then retry this vault call.` |
| Server configuration | `bw config server failed: D` | `bw config server failed: D` followed by `Check the vault server URL and the Bitwarden CLI configuration, then retry this vault call.` |
| Initial login fallback | `Login failed: D` | `Login failed: D` followed by `Retry this vault call to enter the email and master password again in private prompts. If the same error persists, check the account in Bitwarden.` |
| Unsupported two-step method | `Login failed: the account does not use METHOD for two-step login.` | `Login failed: the account does not use METHOD for two-step login. Retry this vault call and use a method enabled for this account: a registered YubiKey, an authenticator code, or an empty code for email.` |
| Login fallback after two-step | `Login failed: D` | `Login failed: D` followed by `Retry this vault call for new private login prompts. Check the account's enabled two-step method if it still fails.` |
| API-key login | `API key login failed: D` | `API key login failed: D` followed by `Retry this vault call and enter the account's client_id and client_secret from Bitwarden Settings > Security > Keys in the private prompts. Do not paste them in chat.` |
| Unlock fallback | `Unlock failed: D` | `Unlock failed: D` followed by `Retry this vault call for a private master-password prompt. If the same error persists, check that the account can be unlocked in Bitwarden.` |
| Wrong-password warning | `Wrong master password for the V vault.` | `The master password did not decrypt the V vault. It may have been mistyped. Enter it again in the private prompt.` |
| Exhausted unlock | `Unlock failed after three attempts.` | `Unlock failed after three master-password attempts. The input did not decrypt the vault. Retry this vault call to get fresh private prompts. Do not send the password in chat.` |
| Server selection cancelled | `Login cancelled.` | `Login cancelled at server selection. If this was accidental, retry this vault call to select the server again.` |
| Invalid server URL | `The server URL must start with https://.` | `The server URL must start with https://. Retry this vault call and enter the full HTTPS server URL in the private prompt.` |
| Missing field | `"ENTRY" has no field "N". Fields: FIELDS` | `"ENTRY" has no field "N". Fields: FIELDS. Retry file with an available field name, or search for the correct entry.` |
| TOTP generation | `bw get totp failed: D` | `bw get totp failed: D` followed by `Check that this entry has a valid TOTP setup in Bitwarden, then request a fresh totp file immediately before use.` |
| Missing CLI | `The Bitwarden CLI (bw) is not on PATH. Install it on this machine first.` | Unchanged. This already identifies the host prerequisite and next action. |
| Process launch exception | Raw exception wrapped as `vault failed: D` | `bw OPERATION failed: D` followed by `Check that the Bitwarden CLI runs on this host, then retry this vault call.`, unless a diagnostic family below supplies more specific guidance. |
| Missing session key | `bw returned no session key.` | `bw returned no session key. Retry this vault call for private login or unlock prompts. If it repeats, check or update the Bitwarden CLI.` |
| Cancelled or empty required input | `Login cancelled.` | `Login stopped because a private prompt was cancelled or left empty. If this was accidental, retry this vault call to get fresh prompts. Enter credentials only there, never in chat.` |
| DPAPI storage | `Windows DPAPI could not protect the unlock key.` | `Windows DPAPI could not protect the unlock key. Check that Windows data protection works for the current account, then retry this vault call. Do not save the key in plaintext.` |
| Keychain storage | `The macOS Keychain could not store the unlock key.` | `The macOS Keychain could not store the unlock key. Unlock the login keychain and allow OMP access, then retry this vault call. Do not save the key in plaintext.` |
| Aborted request | `vault request cancelled` | `vault request cancelled before execution. Retry this vault call only if the task is still wanted.` |
| Missing file parameters | `file needs id and field.` | `file needs id and field. Run vault action search, then set id to a returned entry id and field to an available field name.` |
| Unexpected input, JSON or filesystem exception | `vault failed: D` | `vault failed: D` followed by `Correct the reported input or host error, then retry this vault call. Keep credentials in private prompts, never in chat.` |
| Secret-bearing call guard | `The call contains a vault value. Pass the delivered file path instead.` | Unchanged. This already states the corrective input. |

Shared diagnostic families replace the fallback next step, while preserving `OPERATION failed: D`:

| Family | Before | New next step |
| --- | --- | --- |
| SCCH network/DNS/fetch failure | Raw diagnostic only, such as ENOTFOUND | `The SCCH vault is reachable only on the SCCH network or FortiClient VPN. Connect, then retry this vault call, or use the private vault for personal and university accounts.` |
| Other vault network failure | Raw diagnostic only | `The V vault server could not be reached. Check the network connection and the server URL, then retry this vault call.` |
| Rejected credentials | Raw diagnostic only | `The email or master password was not accepted. It may have been mistyped. Retry this vault call to enter it again in private prompts. Do not send credentials in chat.` |
| Invalid or expired two-step code | Raw diagnostic only | `The two-step code was rejected or expired. Retry this vault call for fresh private prompts, then enter a fresh code or touch the registered YubiKey again. Do not send the code in chat.` |
| Locked or expired session | Raw diagnostic only | `The vault session is no longer unlocked. Call vault action lock with vault V, then retry the original vault call for fresh private unlock prompts.` |

Master-key decryption failures during unlock now enter the existing bounded password-reentry loop instead of using the generic unlock fallback. No login retry loop was added.

A missing or expired delivery file has no old or new vault error because vault does not consume that path. The file result now says: `Files are deleted at local midnight or when the vault locks. If the path is missing or expired, call file again for this entry and field and use the new path.` TOTP delivery adds: `TOTP codes expire sooner. Request a fresh totp file immediately before use.` Empty search results now suggest a shorter query, service domain or the other vault when appropriate.

## Task-based trials

The exact final registered names, descriptions, parameter types, requiredness and descriptions are captured in [trial-tools.json](trial-tools.json). A fresh `task` subagent received that list and one task, with no repository, earlier results or explanation of suspected defects. It was told not to execute anything, invent entry ids or invent results. These are reading trials of plans, not successful real-world operations.

### University sign-in

Task: "Can you get my August payslip from campus.aau.at? The browser is at the sign-in page."

Agent: `PluginTools.UniversitySignInTrial`.

Chosen first call:

```json
{"action":"search","vault":"private","query":"aau"}
```

It then planned `file` with the returned entry id, `field: "password"`, `format: "raw"` and a payslip-sign-in purpose. It would use the username from search, fill the browser password directly from the delivered file and request a fresh `totp` file only if needed. It did not search SCCH or ask for credentials in chat. The returned-id dependency and browser prerequisite were explicit. Pass.

### Missing delivered token

Task: "Please rerun the dashboard API check. Yesterday you got its API Token field from my private Bitwarden entry api-dashboard, id 11111111-2222-4333-8444-555555555555, but the file path from that run no longer exists. The check accepts an environment file with DASHBOARD_TOKEN."

Agent: `PluginTools.ExpiredTokenTrial`.

Chosen call:

```json
{"action":"file","vault":"private","id":"11111111-2222-4333-8444-555555555555","field":"API Token","format":"dotenv","name":"DASHBOARD_TOKEN","purpose":"Rerun the dashboard API check"}
```

It would use the returned path with the existing check command and its environment-file option. It would not read or print the token, search unnecessarily or commit. Pass.

### Commit a verified checkpoint elsewhere

Task: "The config lookup fix is verified and staged in ../aqua. It used to resolve the config from the process directory, so running a task from a subdirectory opened the wrong file. Commit it there. Do not push."

Agent: `PluginTools.ExactCommitTrial`.

Chosen call:

```json
{"action":"commit","subject":"fix: resolve config independently of the process directory","body":"Running a task from a subdirectory could open the wrong config because lookup depended on the process directory.","repo":"../aqua"}
```

It selected the correct action, explicit relative repository and causal body, and did not stage or push. Pass.

### Preview without changing Git

Task: "Show me the commit message first without changing Git. The retry fix is already staged in /work/client. We now retry only transient network failures because retrying authentication failures hid the real error. I asked for this after the previous run got stuck."

Agent: `PluginTools.ExactPreviewTrial`.

Chosen call:

```json
{"action":"preview","subject":"fix: retry only transient network failures","body":"Retrying authentication failures hid the real error. Limit retries to transient network failures so authentication errors remain visible.","repo":"/work/client"}
```

It chose preview, retained the target repository and causal body, ignored the request as a reason for the commit and stopped before mutation. Pass.

Two preliminary personal-commit trials using a manually transcribed competitor listing also chose the right actions and causal bodies. The final four trials above replaced that input with the actual registered listing. No wording change to `personal_commit` was justified by either round.

## Verification and release

Version 0.11.14 is prepared. `openspec validate improve-tool-descriptions --strict` passed. `bun run check:local` passed its toolchain, lint, types, dead-code, version, adapter-freshness and active/archive/prospective-spec checks. Its unit run passed 177 tests across eight files, with 635 expectations and no failures. The unit scenarios exercised private-input retries, the real master-key diagnostic, invalid and expired two-step messages without API-key fallback, network guidance, denial/dismissal, missing fields and entries, operation-specific failures and replacement-file guidance.

The prospective-spec check archives only a disposable copy to verify that the delta applies. The repository change remains active and its main accepted spec is unchanged.

Release still requires the full native release gate, applicable CI contexts, review and explicit authorization to archive as part of release preparation, push, merge or tag. No network audit, installed-release gate, full integration suite or fresh-host UI acceptance was run here. No release action is authorized.
