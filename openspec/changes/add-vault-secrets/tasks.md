# Tasks

Implementation starts only after a separate apply instruction. Generic tools remain usable. The threat model and residual-risk treatment in design.md govern these tasks.

## 1. Private state and installed extension boundary

- [ ] 1.1 Add the dependency-free vault factory and injectable UI/process/keystore/clock/filesystem boundaries using the existing extension patterns. Verify import and registration with no `bw`, no prompts and no runtime package installation.
- [ ] 1.2 Implement owner-protected profile, approval, cache, ledger and file paths with atomic writes, per-profile locks and process-identity recovery. Verify isolated-home, concurrency, symlink/junction, unsafe-ACL and stale-owner behavior tests.
- [ ] 1.3 Revise AGENTS.md and README in place to permit only extension-owned private state beneath `~/.omp` and OS-keystore entries, and explain the optional official CLI prerequisite and unchanged plugin-manager ownership. Verify every documented state boundary matches the contract and no host installation/config wrapper is introduced.
- [ ] 1.4 Declare the vault extension and update the catalog, plugin and root versions together when runtime code lands. Extend installed-discovery/release-tree tests to observe every declared factory and reject a damaged vault payload while leaving credentials and tests outside it.

## 2. Profile login and unlock cache

- [ ] 2.1 Implement separate SCCH/private data directories and private server/account configuration. Verify a stub CLI receives only the selected `BITWARDENCLI_APPDATA_DIR`, server selection and child-only authentication environment.
- [ ] 2.2 Implement masked server, email, master-password and code prompts plus private `--passwordenv`/`--raw` handling. Verify cancellation, absent UI, malformed key output and echoed errors never publish prompt input or raw CLI transcripts.
- [ ] 2.3 Implement the bounded private Inquirer dialogue for ordinary MFA and new-device OTP as distinct states. Verify exact prompt recognition, ANSI handling, split prompt chunks, private stdin replies, unknown/repeated challenges, timeout and terminated-child behavior without a manual plaintext fallback.
- [ ] 2.4 Implement macOS Keychain and Windows CurrentUser DPAPI adapters with private subprocess input. Verify encrypted storage, denied keystore access, server/account binding and no plaintext fallback with platform behavior tests.
- [ ] 2.5 Implement calendar-correct midnight expiry, live lock, startup expiry recovery, reference revocation and file removal. Verify DST, clock rollback, corrupt/future-issued envelopes, concurrent use and midnight during an extension-owned exec.
- [ ] 2.6 Add README setup/use guidance for first login, supported challenge behavior and same-day reuse. Verify the guide asks for no pasted credentials, environment pre-export or terminal unlock alias.

## 3. Entry selection and permission

- [ ] 3.1 Implement names-only search/listing over private CLI item output and random selection IDs. Verify duplicate names work and username, URL, notes, passwords, custom values and raw item JSON never enter result content/details.
- [ ] 3.2 Implement `always`, `once` and `deny`, keyed by server/account/entry UUID, with local revocation. Verify rename stability, identity changes, cancellation and multi-field one-operation permission without repeated per-command approval for always-approved entries.
- [ ] 3.3 Implement opaque field references and exact-ID field resolution without credential-derived tokens. Verify immutable model input, authority revalidation on restart and no plaintext tool-call input revision.
- [ ] 3.4 Document search, approval, opaque references and local lock/revoke actions in README. Verify the documented examples contain references only and no raw vault values.

## 4. Literal scrubbing and restart continuity

- [ ] 4.1 Implement the deduplicated known-value registry and small synchronous literal-string scrubber for strings, arrays and plain nested objects. Verify short/Unicode/whitespace values, overlapping literals, cycles and precomputed JSON spellings without regex, I/O or asynchronous hook work.
- [ ] 4.2 Wire normal `tool_result` content/details replacement, pre-rasterization `context` scrubbing, final payload text scrubbing and the defensive literal-argument guard. Verify replacement results in captured actual OMP messages and prove that ordinary bash/eval remain enabled while caches/files exist.
- [ ] 4.3 Implement authenticated OS-protected per-session ledgers, non-value session markers and atomic commit-before-delivery. Verify restart with a locked/offline vault and entry rotation preserves old-value redaction without granting new entry access.
- [ ] 4.4 Implement supported foreground admission cancellation when a required ledger is unavailable. Verify with an actual capture provider that no foreground request is sent until recovery, and explicitly record secondary paths whose API has no reliable veto.
- [ ] 4.5 Add behavior tests for handler exceptions/timeouts and pre-hook streaming/artifacts to demonstrate the residual failure modes instead of silently claiming universal blocking. Update README's privacy explanation with the accepted accidental-disclosure model and these limits.

## 5. CLI environment and file delivery

- [ ] 5.1 Implement extension-owned exec with argument arrays, child-only secret environment bindings and protected file bindings. Verify real receiving processes obtain the canary while model-authored arguments and parent `process.env` remain value-free.
- [ ] 5.2 Implement raw field, header and dotenv files with format-aware name validation, exact value preservation, owner-only permissions and lock/expiry cleanup. Verify actual passwordfile/header/dotenv consumers, newline-injection rejection and reusable ordinary-tool path handoff.
- [ ] 5.3 Buffer and scrub extension-owned stdout/stderr/errors before any result, progress or overflow artifact is published. Verify split-secret output, failed commands, overflow limits, nested details and private child transcripts with canary leak detectors and deliberate leak positive controls.
- [ ] 5.4 Add README examples for environment, passwordfile, header and dotenv use and explain when extension exec is preferable to generic tools. Verify examples contain only opaque references and paths and do not imply a command allowlist or shell sandbox.

## 6. Tern browser delivery

- [ ] 6.1 Add a native browser override that preserves ordinary calls and recognizes opaque references only in supported fill value arguments. Clone private delegated params and use same-tool `ctx.invokeTool` without revising persisted input. Verify fake-native and actual OMP delegation tests observe refs in history and canaries only in the private native invocation.
- [ ] 6.2 Sanitize delegated updates, errors, content, details and metadata and return fixed status for secret fills. Verify the actual native Tern fill path produces no pre-return raw artifact, and reject unsupported secret-bearing mixed chains without a plaintext eval fallback.
- [ ] 6.3 Add browser-login behavior tests and README guidance for filling, submitting and continuing ordinary browser work. Verify bash/eval remain usable and that known text echoes are scrubbed while screenshot/bridge/pre-hook limitations are stated explicitly.

## 7. Cross-path integration and host acceptance

- [ ] 7.1 Extend the real OMP capture-provider suite to inspect payloads, session JSONL, nested transcripts, output artifacts and fresh-process resume for non-pattern canaries. Exercise main requests, compaction, snapcompact, handoff, advisors, auto-learn and task/eval child paths, with positive controls and explicit residual-path outcomes.
- [ ] 7.2 Verify exported HTML and default/custom share contents after normal supported delivery. Demonstrate any unsanitized pre-hook or legacy artifact limitation separately and do not attribute share protection to the provider hook.
- [ ] 7.3 Run the applicable native repository gate and strict active/archive OpenSpec checks after all implementation units land. Verify installed-cache vault discovery and stub-CLI behavior under isolated profiles on the configured host matrix without real credentials.
- [ ] 7.4 Complete throwaway-canary acceptance in both vaults on Korolev and macbook-pro, including masked prompts, installed CLI MFA/new-device dialogue when demanded, Keychain/DPAPI cache reuse, all CLI binding forms, Tern fill, lock and restart. Record captures and outcomes in this change before authorizing any real entry.
- [ ] 7.5 Review the supported-path results and residual risks against design.md. Verify no final claim says that malicious same-user code, every hook failure, arbitrary encoding, screenshot or unhooked export is universally protected, and keep a failing supported delivery path unavailable until repaired.

## Workflow follow-up

- Archive after implementation, applicable checks and review are complete. Do not archive this planning-only change.
- Publish, tag, push or upgrade the real plugin only with explicit authorization.
