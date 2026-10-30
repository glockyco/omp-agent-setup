# Design

## Context

See proposal.md for motivation. This change proposes planning artifacts only. Runtime, documentation and rule edits require a separate apply instruction after review.

The existing extensions are dependency-free default factories with injected process/filesystem boundaries for tests. Plannotator owns temporary resources and cancels them on session transitions. Reuse those patterns for profiles, private files and subprocesses. Unlike the existing commit tool, vault operations must not forward raw exception messages.

### Threat model and review decision

The disclosure invariant concerns accidental exposure during normal agent use. The extension must not intentionally put a fetched value into model-authored tool arguments, tool results or session history. It must scrub accidental text echoes and preserve that protection on resume. It is not a sandbox against deliberately malicious or prompt-injected agent code with shell access, hostile same-user processes, arbitrary plugins or a compromised destination application. Same-user code can read DPAPI, Keychain, git credentials, SSH keys and browser cookies today.

Generic bash, eval, browser and task use stays enabled, including while an unlock cache or delivery file exists. Per-entry approval prevents unapproved vault fetches. It does not attempt to prove arbitrary same-user code cannot read local credentials. The design explicitly accepts residual risks where OMP's current extension API does not provide a reliable interception or veto. Do not represent these as a universal no-leak guarantee.

### Verified OMP source

The sparse-cloned source is OMP v18.14.0, commit `31147f9d1a76608549821c3759f8487b4d66c72d`. Paths are relative to `packages/coding-agent/src/`. These are source observations, not runtime acceptance results:

| Boundary | Source | Observed behavior |
| --- | --- | --- |
| Masked prompts | `extensibility/extensions/types.ts:211-222,333-334` | `ctx.ui.input` accepts `{ secret: true }`. |
| Input replacement | `extensibility/shared-events.ts:337-350`, `session/agent-session.ts:5587-5645` | Revised `tool_call` input becomes displayed, persisted and executed arguments. Plaintext substitution here is unsafe. |
| Persistence | `session/agent-session.ts:4122-4137` | Session messages are appended to the session manager, not filtered through the provider transform. |
| Result replacement | `extensibility/extensions/wrapper.ts:520-570` | A successful `tool_result` patch replaces content/details returned to the loop and therefore its normal persisted final result. Earlier updates/artifacts are not undone. |
| Failure policy | `extensibility/extensions/runner.ts:1734-1820,2009-2058` | Result-handler errors/timeouts have no failure replacement and can leave original output intact. |
| Context | `extensibility/extensions/runner.ts:2234-2300` | The hook transforms a cloned per-request context. It does not rewrite stored sessions. Errors/timeouts can skip it, but an aborted context signal is rethrown. |
| Final payload | `sdk.ts:4522-4524`, `extensibility/extensions/runner.ts:2304-2337` | `before_provider_request` replaces a serialized payload. A thrown error does not reliably block it because handler failures are swallowed. |
| Image order | `sdk.ts:4448-4456,4495-4508` | Context runs before provider transforms. Built-in obfuscation runs before snapcompact rasterization. A final text scrub cannot recover text already converted into images or blob URLs. |
| Built-in secret loading | `sdk.ts:2024-2029,5046-5050` | Registry construction happens at startup or first enable, with no extension API for registering newly fetched values. |
| Tool-call veto | `extensibility/extensions/runner.ts:2071-2125` | Tool-call gate failures/timeouts block execution. Use this for an affected vault operation, not to restrict unrelated tools. |
| Native delegation | `extensibility/extensions/types.ts:868-881`, `extensibility/extensions/runner.ts:724-753,1667-1677` | A re-registered tool can invoke only its same-name native implementation inside `execute`. Explicitly override inherited progress callbacks. |
| Browser artifact timing | `tools/browser.ts:654-704` | Native browser run output can allocate and write over-cap artifacts before its tool-result hook. |
| Tern | `tools/browser.ts:162-167,196-203`, `tools/browser/tern/kind.ts:1-29` | Native browser selection supports Tern. The extension need not own another browser transport. |
| Eval browser bypass | OMP `hooks.md`, tool-event section | Browser prelude calls and tab helpers are host bridge calls, not AgentTool calls. They do not individually emit the tool hooks. |
| Advisors | `session/session-advisors.ts:1466-1470` | Advisors reuse side-request conversion and the payload hook, not necessarily the foreground context hook. |
| Handoff | `session/session-handoff.ts:153-181` | Handoff builds a side context and invokes the side stream. Foreground-hook coverage alone is insufficient. |
| Maintenance | `session/session-maintenance.ts:1326-1368,1421-1425,1532-1534` | Compaction has separate cancellation and conversion paths, including rasterization. |
| Auto-learn | `sdk.ts:5502-5527` | Capture bypasses `emitContext` in its own transform but inherits `onPayload`. |
| Share | `modes/controllers/command-controller.ts:511-551` | Custom sharing exports HTML directly. Default sharing optionally uses OMP's own obfuscator. No universal vault-specific pre-share hook was found. |
| Cancellation | `extensibility/extensions/types.ts:773-778`, `extensibility/extensions/runner.ts:2297-2299` | `ctx.abort` and `ctx.shutdown` exist. Foreground context cancellation checks its signal before returning. This is not evidence that every side request is vetoable. |

The inspected [Bitwarden login source](https://github.com/bitwarden/clients/blob/ac1f433eb2cebbe582c1be360629d7fa58b10a55/apps/cli/src/auth/commands/login.command.ts#L99-L100) derives interaction from `BW_NOINTERACTION`. Its [ordinary 2FA and new-device branches](https://github.com/bitwarden/clients/blob/ac1f433eb2cebbe582c1be360629d7fa58b10a55/apps/cli/src/auth/commands/login.command.ts#L311-L365) differ. `--code` supplies ordinary 2FA. New-device verification asks an Inquirer prompt only with interaction enabled and otherwise returns `Code is required.` There is no new-device-code option in this implementation. [Official CLI help](https://bitwarden.com/help/cli/) documents per-account data directories, `--passwordenv`, `--passwordfile` and `--raw`. Installed CLI compatibility still needs acceptance.

## Goals / Non-Goals

### Goals

- Agent-initiated names-only discovery, remembered entry approval and delivery without displaying values or requiring manual terminal unlock steps.
- Value-free persisted tool-call arguments for CLI and browser use.
- Simple synchronous redaction of known literal values before final tool results, text provider context and final payload serialization are published.
- OS-protected same-day unlock reuse and durable redaction continuity after restart or entry rotation.
- Ordinary coding tools remain usable without a vault-wide restricted mode.

### Non-goals

- No OS sandbox, arbitrary-code containment, malicious-agent defense, arbitrary transformation detection or OCR-based guarantee.
- No OMP patches, runtime npm packages, duplicate browser service, global environment export or secrets in the installed payload.
- No claim that a later result patch rewrites an already-saved artifact, that a provider hook always runs, or that images/encrypted replay can be scrubbed as text.

## Decisions

### 1. Separate discovery, authority and delivery

Expose `vault_search`, `vault_ref` and `vault_use`, plus a local `/vault` command for locking, profile management and approval revocation. Search internally parses `bw list items` but returns only entry names and random opaque selection IDs. Never return usernames, URLs, notes, custom values or raw item JSON. Duplicate names receive distinct selection IDs. Entry names themselves are intentional model-visible metadata. A profile whose item names contain secrets needs local renaming or exclusion before discovery.

`vault_ref` privately approves an exact entry and requested field names, then returns a random opaque reference. Supported fields are username, password, notes and explicitly selected scalar custom fields. Raw item JSON stays private. Fetch by exact entry UUID, not ambiguous search. References do not encode UUIDs, usernames, values or value-derived hashes and do not use OMP's reversible `$$...$$` token syntax.

`vault_use` resolves values inside its `execute`, registers them for redaction, saves the protected redaction ledger and only then delivers them. Original tool input remains immutable. Never return a plaintext `input` revision from a tool-call hook. Bind references to vault identity, entry, field and approval revision. Restart revalidates authority before fresh delivery rather than assuming an old transcript reference is still an access grant.

### 2. Choose files and child environments over tool-call substitution

| Mechanism | Decision and reason |
| --- | --- |
| Replace reference tokens with plaintext in `tool_call` and scrub later | Reject. The replacement is what OMP persists and displays before execution. Provider-only redaction cannot repair that. |
| Hand over a protected file path, then use `--passwordfile`, a header/config file, `$(cat p)` or `await Bun.file(p).text()` | Support. Model-authored input contains a path and code, not a secret. Document that shell expansion can put values in local child argv and generic output still needs scrubbing. |
| Extension-owned exec with env/file bindings | Preferred for CLI. The extension can inject values after persistence and scrub stdout/stderr/errors before any OMP update or artifact is produced. |
| Browser override using same-tool `ctx.invokeTool` | Preferred for browser fill. The wrapper privately resolves values during execution while the recorded call remains opaque. Avoid putting the value in eval source. |

Do not ban general bash/eval because a private file or key cache exists. Agent instructions prefer the extension-owned exec path when a command may echo a credential, but ordinary tools remain available.

### 3. Support practical CLI delivery without a second shell implementation

`vault_use` offers `exec` and `file` operations. `exec` takes an executable, argument array, working directory, environment bindings and optional file bindings. Secret bindings contain references, not values. Spawn with Bun's process API, child-only environment and private stdin/stdout/stderr. Do not mutate `process.env`, inherit terminal streams or invoke native bash/eval from this tool. Non-secret arguments can name private generated paths. Commands that need a shell may explicitly choose the host shell as executable. That does not make the extension a sandbox.

Provide text serializers for a raw field file, header file and dotenv file. Validate header/variable names and reject newline injection where the format cannot represent the value. Do not trim field values or silently lose leading/trailing spaces. Preserve the CLI's transport newline separately from the actual field contents. Return the created path and expiry, never the bytes. Private files are reusable by normal tools until lock or midnight. An exec operation may request automatic deletion on completion instead.

CLI examples to exercise during acceptance include a token injected as `GH_TOKEN`, a passwordfile consumer, curl header/config-file authentication and a dotenv-aware command loading a protected `.env` file. Do not require one permanently allowlisted executable set. Per-entry approval remains the entry guard. No extra approval loop is added merely for each command that uses an already approved entry.

For extension-owned exec, replace registered literal values in stdout/stderr incrementally before publishing progress. Keep a tail of at least the longest registered value minus one code unit so matches split across chunks are caught. Use the same scrubber on completion and errors. If chunk handling is complex, buffer output privately to a bounded limit and publish only a scrubbed final result. Prefer buffering in the first implementation. Save only scrubbed output artifacts, never raw overflow. Do not use generic logger/error helpers with child transcripts. Return fixed error codes if private output cannot be processed safely.

### 4. Wrap native browser fill at execution time

Re-register the native `browser` tool using its discovered schema and delegate ordinary calls unchanged. In supported fill calls, recognize an opaque reference only in the value argument. Clone parameters before resolving references. Do not mutate the original params object, provider metadata or persisted assistant message.

The wrapper resolves the entry, registers the value and saves the ledger before calling `ctx.invokeTool` with the private cloned arguments. Restrict secret-bearing delegation to the native fixed fill operation, not a model-supplied code string containing embedded values. A call with a secret reference plus screenshot/eval/output-producing chain steps is split into separate calls or rejected as an unsupported secret-bearing combination. This is a narrow operation check, not a browser-wide restriction.

Pass a no-op or sanitizing `onUpdate` explicitly because native delegation inherits updates by default. Catch delegated errors inside the wrapper and sanitize them. For the secret fill itself return fixed status metadata instead of native details, URL, screenshots or provider metadata. Test the real native fill path to establish that it emits no pre-return raw output artifact. If a runtime violates this assumption, refuse that fill path without a plaintext eval fallback.

The agent can submit and continue normal browser work afterwards. Text snapshots and later results use the known-value scrubbers. Browser screenshots, page console/network capture and eval-side display paths remain residual risks where native code or bridge helpers can produce output before interception. Do not claim that password masking, clearing an input or a final payload scan redacts every screenshot or new authentication cookie. Suppress a known-sensitive image when the wrapper directly owns it. Do not disable all browsing to solve an unproven image path.

### 5. Keep scrubbing simple and synchronous

Maintain an already-loaded in-memory array of non-empty literal values, longest first, and precomputed JSON-escaped spellings needed by serialized payloads. Deduplicate at registration, not during each request. Support short values and Unicode without relying on OMP's eight-character threshold or built-in token patterns. Plain string replacement is the matching algorithm. No regex, vault lookup, keystore call, filesystem access, asynchronous work or logging occurs inside scrub hooks.

Use a small cycle-aware walker over strings, arrays and plain objects. Preserve non-text protocol structure. Scrub tool-result `content`, nested `details`, error text and any extension-owned additional context. Return an explicit replacement object when changed. Scrub `context` before snapcompact can turn text into images, then scrub recognized strings throughout `before_provider_request` for final provider-native representations. Do not claim unknown encrypted payloads or binary bytes can be parsed.

Register a `tool_call` guard that catches accidental use of a literal registered value in an incoming call and returns a fixed non-value failure. Do not rewrite it to plaintext. This is defense after prior disclosure, not proof that the original provider-authored message could never have been persisted first. The primary design prevents the value entering the model in the first place.

All extension-owned paths scrub before returning, updating or saving artifacts, independent of the generic result hook. Generic tool echoes use the hook. OMP can skip result/context/provider handlers on error or timeout, so these hooks are best effort in those failure modes. Small no-I/O synchronous handlers reduce that risk, but do not change OMP's failure semantics. Do not attempt to block providers by throwing or by returning an invented `{ block: true }` payload.

### 6. Persist a private redaction ledger before exposure

Write an OS-protected per-session ledger before any value is delivered. Include the exact fetched value, session identity, profile/entry/field identity, ledger version and literal variants required by the scrubber. Never put plaintext ledger entries in `appendEntry`, logs, plugin settings or session metadata. Persist only a non-value marker identifying the ledger and generation in the session.

On Windows use a CurrentUser DPAPI-protected ledger file. On macOS use a session key protected in Keychain and an authenticated encrypted ledger file using native `node:crypto`. The file's encryption key is never placed in an environment inherited by generic tools. Same-user malicious access is outside the threat model. Atomic ledger commit must succeed before delivery. Failure blocks that delivery, not unrelated coding tools.

Reload the ledger during session startup/resume before normal requests. Preserve fetched historical values across entry rotation. Do not rebuild the registry only from current vault values because an old value may still occur in history. Keep ledger protection separate from the unlock-cache expiry. Midnight removes unlock authority and delivery files, but must not delete the only redaction data needed by an old session. A local explicit forget action can remove the ledger once its session is removed or intentionally abandoned.

Track `ready` versus `unavailable` in memory. If a session marker requires a missing/unreadable ledger, cancel foreground admission using the supported context/abort path before normal replay, request private recovery and keep the affected session paused. Validate actual cancellation against a capture provider. If recovery cannot restore old values, start a clean session rather than silently using current values as a complete registry. No I/O occurs in the cancellation hook. Side requests and share paths without a universal veto remain documented limitations rather than fabricated coverage. If an owned secondary operation can be cancelled or refused cheaply while registry readiness is false, do so.

### 7. Authenticate privately, including new-device verification

SCCH uses `https://password.scch.at`. Ask through a masked prompt for the private vault's US or EU cloud endpoint at first login. Bind server and email in private profile state. Run `bw config server` inside the selected data directory before login. No config directory or wrapper comes from nix-config.

Use `ctx.ui.input(..., { secret: true })` for server, email, master password, ordinary 2FA and new-device OTP. Prompt values never pass through the composer, tool arguments, notifications or session entries. Require an actual masked interactive UI. A headless caller gets a fixed unavailable status rather than a request to paste credentials into chat.

Pass master passwords through a randomly named child-only variable and `--passwordenv`. Consume `bw login/unlock --raw` privately. Pass session keys through child-only `BW_SESSION`, not the process-wide environment or `--session` arguments. The observed unlock response is an 88-character base64 string. Validate transport shape without printing unexpected stdout. Never cache a master password or OTP.

Ordinary noninteractive login may use the documented MFA options, but new-device OTP cannot be supplied by `--code` in the inspected implementation. Use a bounded private Inquirer dialogue with interaction enabled, private pipes and no inherited terminal. Recognize exact supported prompts after removing ANSI codes privately, ask the masked OMP UI and answer the waiting child's stdin. This also avoids codes in local process arguments. Never forward raw transcripts or echoed answers. Cancellation, unsupported prompt, repeated challenge, timeout, CAPTCHA or unsupported SSO terminates the child without exposing input. Installed Windows/macOS builds must pass the private-pipe challenge tests. A pipe-incompatible build leaves authentication unavailable rather than falling back to a manual terminal or unmasked prompt.

Sync after unlock before search/use. Serialize login, unlock, sync, config and cache updates per profile. Do not turn a failed sync into a stale-data success. Fixed status codes communicate failures without raw CLI messages.

### 8. Cache unlock until local midnight

On macOS use the login Keychain with a generic-password service `personal@glockyco/vault/<profile-key>`. Invoke `/usr/bin/security` privately. Use its private interactive stdin for writes rather than a shell command containing the key. Read password stdout into private memory only. OS access prompts are allowed. Missing/locked/denied Keychain never falls back to a plaintext file.

On Windows use host PowerShell CurrentUser DPAPI, through `ConvertFrom-SecureString` without an explicit key or `ProtectedData` CurrentUser. Supply the envelope over private stdin, not command arguments. Save only ciphertext with a verified current-SID/SYSTEM DACL and inheritance disabled. Windows Hello is not available and is not required. Credential Manager would add native interop without changing the same-user trust model, so the simpler DPAPI-protected file is selected.

The protected unlock envelope contains the key, server/account binding, issuance time, local date and next-local-midnight absolute expiry. Compute expiry with local calendar operations, including DST. Reject expiration, clock rollback, future-issued envelopes, corrupt data or changed identity before use. A live timer revokes references, ends extension-owned children as necessary, removes delivery files, runs `bw lock` and removes the cache. A process not running at midnight cannot run a timer. Startup rejects the expired key before use, performs cleanup and locks the profile. Do not claim a native keystore TTL or offline cleanup that did not run.

Locking removes entry delivery authority, not the in-memory literals or encrypted ledger still needed for accidental-output redaction. Those must not become a way to issue new field references without entry approval and vault authority.

### 9. Remember entry approval and give state a single owner

Offer `always`, `once` and `deny` through local UI. Persistent decisions key canonical server, account and exact entry UUID. Renaming an item does not reset permission. Changing account/server does. One-time permission covers one operation, which may deliver several requested fields from that entry, and expires on cancellation or session transition. No comment prompt or repeated per-command approval is added for an always-approved entry.

| State path | Contents |
| --- | --- |
| `~/.omp/vault/profiles.json` | Private server/account configuration and schema version, no master password or session key. |
| `~/.omp/vault/bw/scch/`, `~/.omp/vault/bw/private/` | Official CLI data selected with `BITWARDENCLI_APPDATA_DIR`. |
| `~/.omp/vault/approvals.json` | Versioned entry decisions, no field values. |
| `~/.omp/vault/cache/<profile-key>.dpapi` | Windows protected unlock envelope. macOS uses Keychain. |
| `~/.omp/vault/scrub/<session-id>.enc` | OS-protected redaction ledger. Windows uses DPAPI, macOS uses authenticated encryption with a Keychain-held key. |
| `~/.omp/vault/files/<random-id>/` | Owner-protected raw field, header and dotenv files. Delete on lock/expiry, optionally after exec. |
| `~/.omp/vault/recovery.json`, `~/.omp/vault/locks/` | Non-value resource ownership and serialized update state. |

Canonicalize paths and reject symlink/junction escapes. POSIX directories/files use owner-only permissions. Windows disables inherited ACLs and verifies the allowed SID set. A permission failure stops the affected delivery before any value is written. Use atomic config/approval/ledger replacement and exclusive per-profile locks. Resolve stale ownership with PID plus process-creation identity/nonce, not age alone. Never delete another live process's file.

Register lifecycle cleanup as Plannotator does. Clean operation-scoped files on session transitions. Session-issued reusable files are bounded by lock/end-of-day and may be cleaned earlier when explicitly released. Recovery removes only owned stale files and never logs their contents. An uncertain cleanup failure is visible as a fixed status but does not globally disable bash/eval.

### 10. Cover lifecycle paths honestly

| Path | Protection and remaining limitation |
| --- | --- |
| Persisted tool calls | References/paths stay in original args. No plaintext input revision. Native delegated params are private clones. |
| Extension exec output | Scrub before final result, progress or artifact publication. Failure returns fixed metadata. |
| Generic tool echoes | `tool_result` patches normal final content/details before loop persistence. Pre-hook updates, saved overflow and handler failures remain risks. |
| Later model arguments | The model normally never receives the value. Literal-value guard is defense in depth, not retroactive removal of an already-persisted assistant message. |
| Resume and entry rotation | Protected ledger restores old values before normal replay. Missing ledger pauses supported admission paths until private recovery or a clean session. |
| Compaction/snapcompact | Context scrubbing happens before foreground rasterization. Final payload scan cannot scrub images. Separate maintenance paths require actual canary tests. Cancel owned maintenance cheaply if its registry is unavailable. |
| Handoff/advisors/auto-learn | Clean stored final results and shared literal registry protect normal text. Final payload hook covers paths that call it. Some side conversions bypass foreground context. Do not infer blanket coverage. |
| Task/subagents/eval agents | Child factories share process state or restore the session-family ledger. Register a child value before its output returns to the parent. Keep tools usable. A detached child without registry coverage must not receive extension-issued authority until ready. |
| Browser/eval images and encodings | Native fill avoids plaintext args. Known text is scrubbed. Arbitrary encodings, images and bridge-side artifacts cannot be guaranteed. Suppress known-sensitive output only where the extension owns it. |
| Share/HTML | Normally safe final history contains no values. No universal vault pre-export hook exists. Unsanitized legacy history/artifacts or a skipped result hook remain a risk. Do not claim the provider hook protects share. |
| Unknown hooks/provider payloads | Small literal scrubbers and schema-preserving walkers handle supported strings. Binary/encrypted/unknown representations and hook errors are explicit residuals, not grounds for a blanket tool ban. |

## Rule changes

During apply, revise the blanket `~/.omp` write prohibition in AGENTS.md and README to permit only this extension-owned state and OS-keystore entries. The reason is that private profile state, approvals, cached unlock and restart-safe redaction require durable storage. Keep the installed payload free of credentials, mutable caches and databases. Do not mutate OMP settings, plugin registry or unrelated session files.

Add official `bw` to README's optional host prerequisites. Hosts install it, and this plugin configures accounts. Remove fixed extension-count assumptions from the contract/discovery tests as the new module is declared. Preserve dependency-free runtime, no upstream patches, plugin-manager-only delivery and existing checks. Bump catalog/plugin/root versions with runtime implementation, not with this planning commit.

## Risks / Trade-offs

- OMP's generic result/context/provider hooks fail open on exceptions or timeouts. No-I/O literal replacement reduces risk but cannot establish a universal hard invariant for all failures without upstream changes.
- Generic tools may persist raw streamed/overflow output before result hooks. Prefer extension exec when output might contain credentials. Keeping ordinary tools usable accepts this residual rather than pretending to sandbox them.
- Images, screenshot pixels, binary files, encrypted replay and arbitrary encodings are not text-redaction domains. A final provider scan does not repair images or earlier exports.
- A protected reusable file is intentionally readable by authorized same-user tools. A malicious or prompt-injected command can disclose it. This is outside the accepted accidental-disclosure threat model.
- Encrypted ledgers retain fetched historical values beyond unlock expiry to redact old sessions. They require explicit lifecycle management and protect at rest, not against arbitrary code as the OS user.
- Native browser delegation is same-tool only. Secret-bearing fill must be implemented as a browser override, not as a new tool pretending it can invoke any native tool.
- Private-pipe Inquirer compatibility, Tern prompt masking and the real native browser fill artifact behavior are host acceptance prerequisites, not observed successes.

## Validation and acceptance

Use injected UI, process, clock, keystore and filesystem boundaries plus a stub `bw`. Canary values must match no OMP token pattern. Include values shorter than eight characters, Unicode, whitespace, quotes and multiline notes. Execute generated dotenv/header/files and actual child environment delivery, not source-text tests. Test ordinary MFA separately from the new-device prompt and cancellation/unknown dialogue states.

Use a real OMP integration harness with a capture provider. Inspect provider payloads, persisted session JSONL, child transcripts, output artifacts, exported HTML/share contents and a fresh-process resume whose vault is locked. Exercise echo/error output, split chunks, nested details, native browser fill, main context, compaction, snapcompact, handoff, advisors, task/eval agents and auto-learn. Use positive controls that deliberately inject a raw canary so the detector can fail. Demonstrate handler failures and pre-hook output as residual cases rather than silently excluding or claiming them fixed. No broad regex or model evaluation substitutes for byte-level capture.

Verify ledger commit-before-delivery, missing-ledger cancellation, old values after entry rotation, DST, clock rollback, midnight during exec, concurrent processes, corrupt cache/approvals, junction/symlink escapes and crash cleanup. Actual hosts must confirm browser delegation emits no raw artifact for the supported fill operation. Run applicable native repository checks and installed-cache discovery after implementation. Planning acceptance is strict change validation and a local atomic commit only.

Before real items, use throwaway canary entries in both SCCH and private vaults on Korolev and macbook-pro. Complete masked login, configured ordinary MFA, new-device OTP when demanded, all four CLI binding forms, Tern fill, unlock reuse/lock and restart. Inspect actual Tern/OMP logs and provider captures without printing the canary into a model tool result. Record evidence in the change, not current-state README history. Failed supported-path acceptance blocks that path until repaired. Residual scenarios stay visible for review rather than being represented as verified privacy guarantees.

## Open questions and acceptance facts

The delivery and threat-model choices above are fixed by review direction. These facts are resolved at first use or in acceptance, not by substituting a different design:

- The private cloud region is unknown. Ask privately at first login.
- Installed Bitwarden builds must demonstrate private-pipe new-device/MFA dialogue. Unsupported dialogue fails the affected authentication attempt without a manual plaintext fallback.
- Foreground missing-ledger cancellation must be observed in a capture-provider test. Any secondary path without a reliable veto is recorded as residual risk, not described as universally blocked.
- Native Tern fill must demonstrate no raw update or artifact before return. Failure disables that narrow secret-fill path without disabling ordinary tools.
- The retained encrypted redaction ledger is needed after midnight and entry rotation. A future retention policy must not erase coverage for an active saved session.
