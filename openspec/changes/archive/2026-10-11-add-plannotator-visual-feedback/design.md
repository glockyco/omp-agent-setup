## Context

See `proposal.md` for motivation and the parent change identity. The accepted personal plugin specification already permits dependency-free extensions and prohibits installation or mutable deployment. The current manifest and package checks assume one extension.

The actual OMP checkout exports `resolveLocalUrlToFile` through `@oh-my-pi/pi-coding-agent/internal-urls`. Extension contexts provide `mode`, `hasUI`, `cwd`, `localProtocolOptions`, and a read-only session manager. The manager exposes `getSessionId`, `getLeafId`, and `getBranch`. Commands accept asynchronous handlers. `sendUserMessage` supports `deliverAs: "followUp"`.

Upstream Plannotator 0.27.12 emits `annotated` with string feedback or `dismissed` for plain JSON annotation. Its local listener uses `127.0.0.1`, and port zero requests a random port. Its client lease requires gate mode. The approved contract uses the stock CLI without that lease or a downstream patch. Closing a tab can leave the review pending, with explicit cancellation as recovery.

## Goals / Non-Goals

**Goals:**

- Preserve snapshot and conversation identity across asynchronous browser interaction.
- Keep cancellation available during source preparation and process execution.
- Reuse OMP's native resolver rather than duplicating session-path rules.
- Keep the immutable payload dependency-free and executable selection outside this repository.

**Non-Goals:**

- No agent tool, approval gate, planner, private browser script, source rewrite, remote mode, installer, or fallback executable.
- No removal of unrelated upstream UI features or changes to generated OpenSpec adapters.

## Decisions

### Keep the bridge at the executable boundary

Add one extension and manifest entry. Import the native local resolver only when resolving `local://`, so plugin discovery does not require the executable or load unrelated host internals. Extend development declarations only for fields the adapter uses. Use Bun and Node APIs already present in the host, without runtime packages.

Spawn `plannotator annotate <snapshot.md> --json` directly with no shell. Drain stdout and stderr. Require a successful exit and one valid JSON decision. Treat `approved`, unknown decisions, invalid feedback types, and malformed output as errors. Preserve submitted feedback verbatim inside a source-attributed envelope.

### Capture documents and responses before launch

Resolve ordinary paths against `ctx.cwd`. Pass captured session-local options to the exported resolver; reject a missing native session mapping instead of falling back to another session. Require a regular UTF-8 text file and reject HTML and binary inputs. Create a private temporary directory and a mode-0600 Markdown snapshot. Keep the original bytes and SHA-256 identity; the adapter never writes the source path.

For `/plannotator-last`, inspect `getBranch()` from newest to oldest. Select assistant text from a completed successful message, excluding thinking and tool blocks. Stop at a conversation reset boundary. Do not search session directories or full session history.

### Settle each review once

Reserve the session's pending slot before asynchronous work. Capture the session ID and leaf anchor, then return from the command while source preparation and review run in the background. Repeated requests report the existing review. Separate extension hosts and session IDs retain independent state.

Register cancellation on `session_before_switch`, `session_before_branch`, `session_before_tree`, and `session_shutdown`. Cancellation marks the review before awaiting process exit, so concurrent results cannot deliver feedback. Before delivery, recheck the current session and confirm that the captured anchor remains on its branch. Branch extension during normal model work is allowed.

Compare the current document hash before delivery. If content changed or is unavailable, add a stale-source warning. Deliver through `sendMessage` with `attribution: "user"`, `display: true`, `deliverAs: "followUp"`, and `triggerTurn: true` after the final ownership check. This queues feedback during active work and starts a turn when idle. Explicit `sendUserMessage` follow-up delivery alone leaves an idle session queued. No asynchronous boundary separates the ownership check from delivery.

### Own process and snapshot cleanup

Launch the child in a new process group on supported Unix hosts. On cancellation and settlement, signal only that group and escalate to `SIGKILL` after a bounded termination wait. Await output closure before removing the private directory. Cleanup runs on startup failure, dismissal, protocol error, successful feedback, navigation, and cancellation. Keep user history and preferences outside the owned directory untouched.

A browser that never connects requires explicit cancellation. A closed browser tab can also leave the stock CLI pending. `/plannotator-cancel`, session navigation, and shutdown release that review through the existing cancellation path. Do not add a client-lease patch, gate mode, browser script, review timeout, or fallback.

### Constrain the child environment

Require `ctx.mode === "tui"`, `ctx.hasUI`, and no SSH session markers. Reject explicitly remote Plannotator invocation. Clear inherited Plannotator operational overrides and browser overrides, while preserving the user's data-directory selection. Set `PLANNOTATOR_REMOTE=0`, `PLANNOTATOR_PORT=0`, `PLANNOTATOR_SHARE=disabled`, `PLANNOTATOR_URL_HOST=` and `PLANNOTATOR_GLIMPSE=0`. Let upstream choose the macOS or Windows/WSL browser. No sharing flag or approval flag enters argv.

## Risks / Trade-offs

- Native resolver and context declarations can drift. Real OMP discovery and session-local smoke are required in addition to isolated behavior regressions.
- POSIX process groups match the supported Linux and Darwin hosts. Native Windows hosting is unsupported; WSL uses the Linux path.
- Plannotator can retain annotation history according to user preferences. Cleanup deletes only adapter-owned snapshots, not upstream data.
- Background feedback uses OMP's existing queued-message semantics. Navigation must cancel before delivery; final session and branch checks provide a second guard.
- Stock annotation, explicit cancellation after browser closure, and loopback reachability require the actual executable and browser. Unit doubles cannot prove them.

## Verification and Release

Retain regressions for cancellation races, independent sessions, immutable source identity, branch selection, and protocol errors. Replace one-extension assertions with capability discovery. Main runs strict OpenSpec validation, plugin CI, flake checks, and real OMP/browser smoke after concurrent edits settle.

This change does not publish, update workstation pins, activate a host, or archive itself. Release acceptance remains blocked until the parent records stock-package, native-browser, and platform evidence. The workstation retains the on-demand, commit-pinned vendor package. The removed client-lease acceptance does not complete any unrun release gate.
