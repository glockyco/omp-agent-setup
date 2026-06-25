---
title: ACP-Supported Feature Implementation Spec for OMP
type: spec
status: abandoned
created: 2026-05-16
parent:
superseded_by:
archived: 2026-06-25
---

# ACP-Supported Feature Implementation Spec for OMP

## Purpose

Implement the ACP-standard and Zed-advertised integration features that ACP already supports but OMP's native ACP mode does not currently use. The goal is to make `omp acp` behave like a first-class editor-integrated ACP agent in Zed without taking on OMP-only features that ACP does not model, such as `/tree`, dashboards, or TUI selectors.

This spec targets `~/Projects/oh-my-pi`, primarily `packages/coding-agent/src/modes/acp/`, and is written from the perspective of the OMP source tree. It is a design/specification only; it does not prescribe any changes to this `omp-agent-setup` repository beyond documenting the work.

## Current-state summary

OMP already implements the ACP transport and the core session loop:

- JSON-RPC over stdio via `runAcpMode`.
- `initialize`, `authenticate`, `session/new`, `session/load`, `session/list`, `session/resume`, `session/fork`, `session/close`, `session/prompt`, and `session/cancel`.
- `available_commands_update`, `session_info_update`, `usage_update`, tool call updates, assistant/thought chunks, and todo-to-plan updates.
- Model and thinking selection via `SessionConfigOption`.
- MCP server handoff from ACP session requests into OMP's `MCPManager` for stdio/http/sse server definitions.

The main gap is that OMP treats ACP mostly as a message transport. It does not use ACP client capabilities for file I/O, terminals, permissions, auth, interactive input, or richer editor-native tool rendering.

## Scope

### In scope: stable ACP features OMP should implement now

1. Initialize-time capability storage and protocol negotiation.
2. Client filesystem integration: `fs/read_text_file` and `fs/write_text_file`.
3. Resource-link prompt hydration using client filesystem reads.
4. Client terminal integration: `terminal/create`, output, wait, kill, release, and terminal tool content.
5. Permission requests: `session/request_permission`.
6. Rich tool call content: `diff` and `terminal` blocks.
7. More accurate prompt stop reasons.
8. ACP-mode exposure for OMP plan mode through existing ACP mode/config surfaces.
9. Dynamic command refresh when ACP-visible commands change.
10. Correct handling of unsupported prompt content instead of silent degradation.
11. Documentation and tests proving the integration behavior.

### In scope: preview/experimental ACP features to prepare but gate

These are documented RFD/SDK features or Zed-advertised capabilities that should be implemented only behind explicit capability checks and SDK support checks:

1. Terminal auth method support.
2. Elicitation-backed `select`, `confirm`, and `input` bridge for ACP extension UI.
3. Additional workspace directories.
4. Boolean config options if the SDK/client supports them.
5. Request cancellation (`$/cancel_request`) for long-running agent-initiated requests if available in the SDK.
6. MCP-over-ACP transport if it is present in the adopted SDK.
7. Configurable provider/logout/session-delete surfaces if they are present in the adopted SDK and map cleanly to OMP's model registry/session store.
8. Next Edit Suggestions if OMP chooses an editor-proposed-edit path instead of immediate direct edits for supported clients.
9. Agent telemetry export if the SDK/client supports a stable export request.
10. Diff-delete content if the adopted SDK exposes the finalized deleted-file diff shape.


### ACP feature disposition table

| ACP feature | Status | OMP status | Spec disposition |
|---|---|---|---|
| Core session setup/prompt/cancel/update | Stable | Implemented | Preserve and regression-test only |
| Session load/list/resume/close/fork | Stable or actively deployed | Implemented | Preserve; rename stale `unstable_` code symbols opportunistically when SDK supports stable names |
| Session config options | Stable | Partially implemented | Add plan mode; preserve model/thinking |
| Session modes | Deprecated transition surface | Minimal default mode | Keep synchronized with config options for compatibility |
| Agent plan updates | Stable | Implemented via todo mapping | Preserve |
| Session info updates | Stable | Implemented | Preserve |
| Usage/context updates | Deployed/RFD-shaped | Implemented | Preserve and track schema drift |
| Slash command advertisement | Stable | Implemented for ACP-visible commands | Add dynamic refresh only |
| Client filesystem | Stable | Not used | Implement now |
| Client terminal | Stable | Not used | Implement now |
| Permission request | Stable | Not used | Implement now |
| Diff tool content | Stable | Not emitted | Implement now |
| Terminal tool content | Stable | Not emitted | Implement with terminal integration |
| Prompt content resource links | Stable | Lossy | Hydrate through client filesystem |
| Prompt audio | Stable optional capability | Not advertised, silently degraded | Reject or explicitly report unsupported content |
| Auth methods | RFD/partially deployed | No-op `agent` method | Prepare terminal/env auth only when real OMP auth flow exists |
| Elicitation | RFD/experimental | Not used | Preview-gated UI bridge |
| Additional directories | RFD/experimental | Ignored | Preview-gated after multi-root support is real |
| Boolean config options | RFD/experimental | Rejected | Preview-gated small set of session booleans |
| Request cancellation | RFD/experimental | Not handled | Preview-gated cleanup mechanism |
| MCP-over-ACP | RFD/experimental | Not implemented; ordinary MCP server handoff is implemented | Preview-gated ACP transport only |
| Provider config/logout | RFD/experimental | Not implemented | Preview-gated after model registry mapping is designed |
| Session delete | RFD/experimental | Not implemented | Preview-gated after session-store deletion policy is explicit |
| Next Edit Suggestions | RFD/experimental | Not implemented | Preview-gated alternative edit path, not required for direct edit parity |
| Agent telemetry export | RFD/experimental | Not implemented | Preview-gated read-only export |
| Remote HTTP/WebSocket transports | RFD/working group | Not implemented | Defer; local Zed subprocess integration remains stdio |

### Out of scope

Do not implement ACP extensions for OMP-only features in this project. Specifically exclude:

- `/tree` and session tree navigation.
- TUI dashboards (`/settings`, `/extensions`, `/agents`, `/mcp smithery-search`, etc.).
- Clipboard, STT, image paste, external editor, or terminal keybinding parity.
- Custom `_omp/*` methods unless needed as internal implementation plumbing for an ACP-standard feature. Tree/navigation custom methods should be covered by a separate spec.
- Public ACP registry packaging.

## Source references

Primary protocol and client sources:

- ACP initialization: https://agentclientprotocol.com/protocol/initialization
- ACP file system: https://agentclientprotocol.com/protocol/file-system
- ACP terminals: https://agentclientprotocol.com/protocol/terminals
- ACP tool calls and permission requests: https://agentclientprotocol.com/protocol/tool-calls
- ACP slash commands: https://agentclientprotocol.com/protocol/slash-commands
- ACP extensibility: https://agentclientprotocol.com/protocol/extensibility
- ACP RFD index: https://agentclientprotocol.com/llms.txt
- Zed ACP client capabilities: `zed/crates/agent_servers/src/acp.rs`, especially the initialization request that advertises `fs.readTextFile`, `fs.writeTextFile`, `terminal`, and `auth.terminal`.

Primary OMP source touchpoints:

- `packages/coding-agent/src/modes/acp/acp-agent.ts`
- `packages/coding-agent/src/modes/acp/acp-event-mapper.ts`
- `packages/coding-agent/src/modes/acp/acp-mode.ts`
- `packages/coding-agent/src/session/agent-session.ts`
- `packages/coding-agent/src/tools/read.ts`
- `packages/coding-agent/src/tools/write.ts`
- `packages/coding-agent/src/tools/bash.ts`
- `packages/coding-agent/src/edit/`
- `packages/coding-agent/src/mcp/manager.ts`
- `packages/coding-agent/test/acp-agent.test.ts`
- `packages/coding-agent/test/acp-event-mapper.test.ts`

## Architecture decision

Introduce an ACP integration layer owned by the active `AcpAgent` instance. Do not thread raw `AgentSideConnection` references into arbitrary tools. Instead, add small injected adapters at the session/tool boundary.

### New conceptual components

#### `AcpClientState`

Stores immutable connection-level facts from `initialize`:

```ts
interface AcpClientState {
  protocolVersion: number;
  clientInfo?: Implementation;
  fs: {
    readTextFile: boolean;
    writeTextFile: boolean;
  };
  terminal: boolean;
  authTerminal: boolean;
  elicitation: {
    form: boolean;
    url: boolean;
  };
  additionalDirectories: boolean;
  booleanConfigOptions: boolean;
  mcpOverAcp: boolean;
  rawCapabilities: InitializeRequest["clientCapabilities"];
}
```

Default every omitted capability to unsupported. OMP must never call an optional client method unless the stored state says the client supports it.

#### `AcpSessionServices`

Per managed session services attached to `ManagedSessionRecord`:

```ts
interface AcpSessionServices {
  fileSystem?: AcpClientFileSystem;
  terminal?: AcpTerminalExecutor;
  permission?: AcpPermissionGate;
  ui?: AcpExtensionUiBridge;
  additionalDirectories: string[];
  openTerminals: Map<string, TerminalHandle>;
  pendingPermission?: AbortController | PromiseLike<unknown>;
}
```

These services wrap `AgentSideConnection` calls and centralize cancellation/cleanup. They are the only code allowed to call ACP client methods.

#### Tool integration strategy

Add optional tool-runtime hooks rather than forking each tool implementation. The hooks should be passed through existing session/tool execution dependencies, not imported globally.

Required hooks:

```ts
interface ClientFileSystemAdapter {
  readTextFile(request: { sessionId: string; path: string; line?: number; limit?: number }): Promise<string>;
  writeTextFile(request: { sessionId: string; path: string; content: string }): Promise<void>;
}

interface ClientTerminalAdapter {
  execute(request: AcpTerminalExecutionRequest): Promise<AcpTerminalExecutionResult>;
  abortAll(): Promise<void>;
}

interface ClientPermissionAdapter {
  requestToolPermission(request: AcpPermissionRequest): Promise<AcpPermissionDecision>;
  cancelPending(): void;
}
```

The direct filesystem/process implementations remain the fallback when the client does not support the ACP capability or when the operation is outside the capability's safe semantics.

## Feature specifications

### 1. Initialization and capability negotiation

#### Current behavior

`AcpAgent.initialize(_params)` ignores `InitializeRequest`, returns `PROTOCOL_VERSION`, and declares OMP agent capabilities.

#### Required behavior

1. Rename `_params` to `params` and store normalized `AcpClientState` on the `AcpAgent` instance.
2. Return the requested protocol version if it equals OMP's supported `PROTOCOL_VERSION`; otherwise return OMP's supported version and let the client close if unsupported.
3. Preserve existing agent capabilities.
4. Add `_meta.omp` capability metadata with the OMP ACP implementation version and enabled optional integrations.
5. Do not advertise preview capabilities unless the implementation is complete and gated.

Example metadata:

```json
{
  "agentCapabilities": {
    "_meta": {
      "omp.dev": {
        "clientFsIntegration": true,
        "clientTerminalIntegration": true,
        "clientPermissionIntegration": true,
        "previewElicitationBridge": false
      }
    }
  }
}
```

#### Acceptance criteria

- Unit test: `initialize` stores each supported/omitted client capability with correct defaults.
- Unit test: omitted `clientCapabilities` subobjects are treated as unsupported.
- Unit test: `clientInfo` is recorded for diagnostics without affecting behavior.
- No optional ACP client method is callable before successful initialization.

### 2. Client filesystem integration

#### Current behavior

OMP tools read and write directly using local filesystem APIs. Zed's unsaved buffers are invisible, and writes are not mediated by Zed.

#### Required behavior

Use `AgentSideConnection.readTextFile` and `writeTextFile` when the client supports the relevant capability and when the operation maps cleanly to text-file semantics.

Read behavior:

1. For text file reads requested by OMP's `read` tool, prefer ACP `fs/read_text_file` when:
   - the path resolves to an absolute local file path;
   - the selector is a line range supported by ACP's `line`/`limit`, or the full text is requested;
   - `clientCapabilities.fs.readTextFile` is true.
2. Fall back to OMP's direct reader for archives, SQLite, binary/image/document parsing, URLs, internal URIs, structural summaries, and non-file resources.
3. Preserve OMP's hashline/line-anchor behavior by applying existing line annotation logic after receiving content from the client.
4. Preserve exact direct-reader behavior when ACP fs is unavailable.

Write behavior:

1. For full text-file writes, use ACP `fs/write_text_file` when `clientCapabilities.fs.writeTextFile` is true.
2. For patch/edit tools, read the old text through the same source that will be written, apply the edit in OMP, then write the resulting whole text through ACP `fs/write_text_file`.
3. Do not use ACP write for binary file writes or SQLite row operations unless a future ACP method supports those semantics.
4. After ACP write succeeds, emit the same OMP tool result shape as direct write, plus structured diff metadata for the event mapper.

Split-brain rule:

- If a file has unsaved editor changes, ACP reads can see content that bash/grep/local tools cannot. The system prompt/tool descriptions must explicitly state that ACP-backed `read` reflects editor buffers while shell commands operate on disk state.

#### Acceptance criteria

- Unit test: with client fs read enabled, text reads call `connection.readTextFile` and direct `fs` is not used for that text path.
- Unit test: with client fs read disabled, existing reader path is unchanged.
- Unit test: range selectors map to ACP `line` and `limit` exactly.
- Unit test: archives/SQLite/URLs/internal URIs never call ACP fs.
- Unit test: full-file write uses `writeTextFile` when enabled.
- Unit test: edit conflict/hash mismatch semantics remain unchanged when using ACP fs.
- Integration-style test: simulated unsaved client content is what the model/tool receives.

### 3. Resource-link prompt hydration

#### Current behavior

`#convertPromptBlocks()` converts `resource_link` to `block.title ?? block.name ?? block.uri`, losing the actual referenced content.

#### Required behavior

1. If a `resource_link.uri` is a local file URI or path and `clientCapabilities.fs.readTextFile` is true, hydrate it with `connection.readTextFile`.
2. Include hydrated content in the prompt text with source labeling.
3. If hydration fails, include a concise failure marker and the original URI; do not silently omit.
4. Preserve existing behavior for non-file resource links.

Suggested prompt rendering:

```text
[resource_link: <name or uri>]
<file content>
[/resource_link]
```

#### Acceptance criteria

- Unit test: local file `resource_link` calls ACP `readTextFile` when supported.
- Unit test: unsupported or failed hydration produces a clear text fallback.
- Unit test: embedded `resource` blocks keep current behavior.

### 4. Client terminal integration

#### Current behavior

OMP bash/python execution uses local process execution. ACP terminal APIs are unused.

#### Required behavior

Implement a terminal-backed executor for command tools when `clientCapabilities.terminal` is true.

Lifecycle:

1. Create terminal with `connection.createTerminal({ sessionId, command, args, env, cwd, outputByteLimit })`.
2. Emit or update the corresponding tool call with `ToolCallContent` terminal block:
   ```ts
   { type: "terminal", terminalId }
   ```
3. Await command completion through `TerminalHandle.waitForExit()`.
4. On timeout, call `TerminalHandle.kill()`, then collect final output via `currentOutput()`.
5. Always call `TerminalHandle.release()` in `finally`.
6. Track open terminal handles on the session and release them during `session/cancel`, `session/close`, and connection cleanup.

Selection policy:

- Use ACP terminal for `bash` commands that do not require OMP's advanced persistent shell semantics.
- Preserve direct OMP execution for commands requiring OMP-only capabilities not expressible through ACP terminal, such as internal bash session reuse if that exists for a specific tool path.
- `python`/IPython persistent kernel should remain OMP-internal unless a command is explicitly shell-executed rather than notebook/kernel-executed.

Output policy:

- The terminal UI is the primary live output surface.
- The tool result returned to the model must still include final stdout/stderr/exit status, so the model has the same semantic feedback as before.
- Large output should use `outputByteLimit` and an artifact/resource link if OMP stores the full result elsewhere.

#### Acceptance criteria

- Unit test: terminal enabled causes bash executor to call `createTerminal` and embed terminal content.
- Unit test: terminal disabled preserves existing local bash executor path.
- Unit test: timeout kills, reads final output, and releases terminal.
- Unit test: cancellation releases all open terminal handles.
- Unit test: terminal IDs are not replayed as live terminal content during `session/load`; replay downgrades stale terminal content to text.

### 5. Permission requests

#### Current behavior

OMP never calls `connection.requestPermission()`. Tool execution proceeds according to OMP's own policy, and ACP clients cannot approve or deny operations.

#### Required behavior

Introduce an ACP permission gate before sensitive tool execution when the client supports permission requests through the SDK connection.

Sensitive tool kinds:

- Always gate by default: `edit`, `delete`, `move`, `execute`.
- Gate when configured: `fetch` and external-network tools.
- Do not gate by default: pure `read`, `search`, `think`.

Permission request shape:

```ts
await connection.requestPermission({
  sessionId,
  toolCall: {
    sessionUpdate: "tool_call",
    toolCallId,
    title,
    kind,
    status: "pending",
    locations,
    rawInput,
  },
  options: [
    { optionId: "allow-once", name: "Allow once", kind: "allow_once" },
    { optionId: "allow-always", name: "Allow always", kind: "allow_always" },
    { optionId: "reject-once", name: "Reject", kind: "reject_once" },
    { optionId: "reject-always", name: "Reject always", kind: "reject_always" }
  ]
});
```

Decision handling:

- `allow_once`: execute once.
- `allow_always`: persist an in-memory allow rule for this ACP session unless OMP already has a persistent permission store that can safely represent the rule.
- `reject_once`: emit failed tool update and return a tool denial result to the model.
- `reject_always`: persist an in-memory reject rule for this ACP session.
- `cancelled`: abort the pending tool and, if appropriate, the prompt turn.

Cancellation rule:

- If `session/cancel` arrives while a permission request is pending, resolve internal waiters as cancelled and do not execute the tool.
- The client is responsible for returning cancelled to the JSON-RPC request; OMP must still clean up its own pending state.

Composition with OMP permissions:

- If OMP has an existing permission decision that denies the tool, deny without asking ACP.
- If OMP has an existing permission decision that allows the tool, OMP may skip ACP permission only when the user explicitly configured OMP as the authority. Otherwise, ACP permission should still be requested so Zed remains the visible approval surface.
- Avoid double prompts. A single tool execution must not require both an OMP TUI prompt and a Zed ACP prompt.

#### Acceptance criteria

- Unit test: write/edit/bash produce permission requests before execution.
- Unit test: read/search do not request permission by default.
- Unit test: rejection prevents tool execution and reports a failed/denied result.
- Unit test: allow-always suppresses a second prompt for the same session and same normalized operation class.
- Unit test: cancel during pending permission prevents execution.
- Regression test: non-ACP modes retain existing permission behavior.

### 6. Rich tool call content

#### Current behavior

`acp-event-mapper.ts` maps structured text/image/audio/resource content but does not emit ACP `diff` or `terminal` tool content.

#### Required behavior

Add first-class mapping for:

1. `diff` content:
   ```ts
   { type: "diff", path, oldText, newText }
   ```
2. `terminal` content:
   ```ts
   { type: "terminal", terminalId }
   ```

Diff generation policy:

- Write/create: `oldText = null` if file did not exist, otherwise previous text.
- Edit: include full old and new file text when available.
- Delete: if the current SDK supports delete diffs, use its shape; otherwise represent deletion as `newText: ""` plus text content stating the file was deleted.
- Move/rename: emit locations for both paths and include text summary; ACP has no stable move diff semantic beyond affected locations.

Avoid duplicating content:

- If a diff block is emitted, do not also emit the full same old/new text as plain text unless needed for model-readable result.
- Keep `rawOutput` complete for debugging and replay.

Replay policy:

- Replaying historical diff content is safe and should be preserved.
- Replaying historical terminal content is not safe because terminal IDs are connection-local; downgrade terminal content to captured text output.

#### Acceptance criteria

- Unit test: write tool result maps to `diff` content with expected old/new text.
- Unit test: edit tool result maps to `diff` content.
- Unit test: terminal tool result maps to terminal content during live execution.
- Unit test: replay strips stale terminal IDs.
- Unit test: raw output remains available.

### 7. Prompt stop reasons

#### Current behavior

OMP returns only `end_turn` or `cancelled`.

#### Required behavior

Map OMP/session/model termination causes to ACP stop reasons when available:

| OMP cause | ACP stopReason |
|---|---|
| Normal completion | `end_turn` |
| User/client cancellation | `cancelled` |
| Context/output limit | `max_tokens` |
| Tool/turn recursion limit | `max_turn_requests` |
| Model/provider refusal | `refusal` |
| Unknown recoverable end | `end_turn` plus diagnostic metadata |

Add internal plumbing only where OMP already records the cause. Do not infer `max_tokens` from text content.

#### Acceptance criteria

- Unit test: simulated max-token end returns `max_tokens`.
- Unit test: simulated max-turn limit returns `max_turn_requests`.
- Unit test: cancellation remains `cancelled`.
- Unit test: unknown errors reject the prompt rather than falsely returning `end_turn`.

### 8. ACP mode/config exposure for OMP plan mode

#### Current behavior

OMP returns one ACP mode, `default`, and exposes model/thinking config options. OMP's plan mode exists outside ACP.

#### Required behavior

Expose plan mode through ACP using `SessionConfigOption` category `mode` as the primary mechanism. Continue returning `modes` for backward compatibility while ACP still supports it.

Mode options:

- `default`: normal OMP agent behavior.
- `plan`: OMP planning mode with the same semantics as interactive `/plan`.

Behavior:

1. Selecting `plan` activates the same session state and tools as TUI plan mode.
2. Exiting plan mode from within the model/tool flow updates the ACP config option back to `default` and emits `config_option_update`.
3. If `setSessionMode` is called instead of `setSessionConfigOption`, keep it in sync with the same state.
4. Do not expose other TUI-only modes unless they have equivalent agent-runtime semantics.

#### Acceptance criteria

- Unit test: new ACP sessions include mode config options `default` and `plan`.
- Unit test: setting mode to `plan` activates OMP plan mode state.
- Unit test: exiting plan mode emits config update.
- Unit test: unsupported mode IDs still fail closed.

### 9. Dynamic available command refresh

#### Current behavior

OMP emits `available_commands_update` during bootstrap. It does not refresh after command providers change.

#### Required behavior

Emit `available_commands_update` whenever ACP-visible command sets change during a session.

ACP-visible commands are:

- file-based slash commands loaded by `loadSlashCommands({ cwd })`;
- TypeScript/custom commands exposed through `session.customCommands`;
- embedded slash-command templates.

TUI-only builtins remain excluded unless separately implemented through ACP-standard behavior.

Refresh triggers:

- plugin reload that changes custom commands;
- capability discovery refresh that changes file-based commands;
- command source changes noticed by existing OMP watchers, if present.

If OMP has no watcher for a source, refreshing on session bootstrap and after explicit reload is sufficient.

#### Acceptance criteria

- Unit test: deduplication by command name remains stable.
- Unit test: command changes emit a new `available_commands_update`.
- Unit test: TUI builtins are not advertised accidentally.

### 10. Unsupported prompt content handling

#### Current behavior

Audio prompt blocks are converted to `[audio omitted]`. Blob resources become `[embedded resource: uri]`.

#### Required behavior

Fail visibly or degrade explicitly according to declared capabilities:

- Since OMP does not advertise `promptCapabilities.audio`, receiving audio should produce a structured prompt error or an explicit unsupported-content message, not silent omission.
- Text resources continue to be embedded.
- Blob resources should be represented by a clear unsupported marker unless OMP can decode the blob type safely.

Preferred behavior:

- Reject unsupported audio with an invalid-params style error before starting a prompt turn.
- For blob resources, include `[unsupported embedded binary resource: <uri> <mimeType>]` in prompt text.

#### Acceptance criteria

- Unit test: audio prompt block is rejected or clearly reported according to the chosen behavior.
- Unit test: text resources still work.
- Unit test: blob resources include URI/mime type in fallback text.

## Preview feature specifications

Preview features must not be enabled by default unless the adopted ACP SDK and target client support them. Each preview feature requires a capability check, tests, and a fallback path.

### A. Elicitation-backed extension UI bridge

Replace module-level `acpExtensionUiContext` with a per-connection factory:

```ts
function createAcpExtensionUiContext(connection: AgentSideConnection, state: AcpClientState): ExtensionUIContext
```

Behavior:

- `confirm` maps to permission request for safety decisions or elicitation boolean form for neutral choices.
- `select` maps to elicitation enum form.
- `input` maps to elicitation string form.
- If elicitation is unavailable, return a typed unavailable result or throw a controlled error; do not silently return `undefined`/`false`.
- `notify` may become an ACP extension notification only if a compatible client capability exists; otherwise logging is enough.

Acceptance:

- Unit test: ACP extension `confirm` does not silently deny when elicitation is supported.
- Unit test: no-elicitation fallback is explicit and observable.

### B. Terminal auth

Zed advertises `auth.terminal` and `_meta.terminal-auth`. OMP currently advertises a no-op agent-managed auth method.

Required behavior when implemented:

- Keep the current `agent` auth method for backward compatibility.
- Add terminal auth only if OMP can launch a real auth command whose success can be observed.
- `authenticate(methodId)` must branch by method ID and return auth-required errors when authentication is missing.
- Do not advertise terminal auth until the path is real.

Acceptance:

- Unit test: `authenticate('agent')` remains no-op/success when local OMP auth is already configured.
- Unit test: terminal auth method is not advertised unless implemented.

### C. Additional directories

When the ACP additional directories RFD is supported by the SDK/client:

- Advertise `sessionCapabilities.additionalDirectories` only after OMP's session, discovery, MCP roots, and tool-access policy all understand additional roots.
- Validate all roots as absolute paths.
- Store the ordered roots on `ManagedSessionRecord` and session metadata.
- Propagate roots to discovery/capability loading and MCP `roots/list`.
- Fail closed for invalid or unauthorized roots; never silently drop them.

Acceptance:

- Unit test: invalid relative root rejects session creation.
- Unit test: MCP roots include `cwd` plus additional roots.
- Unit test: discovery sees additional roots when enabled.

### D. Boolean config options

If the SDK/client supports boolean config options:

- Stop throwing for boolean values in `setSessionConfigOption`.
- Add boolean options only for ACP-relevant session toggles, not the entire OMP settings surface.
- Preserve select config option behavior.

Candidate booleans:

- auto-compact enabled;
- auto-retry enabled;
- require permission for execute/edit tools if this is session-scoped.

Acceptance:

- Unit test: boolean config option update changes session state.
- Unit test: unsupported boolean config still fails closed on older SDK/client combinations.

### E. MCP-over-ACP

Do not confuse ordinary ACP-supplied `mcpServers` with MCP-over-ACP transport. OMP already accepts stdio/http/sse MCP server definitions from ACP session requests. MCP-over-ACP is different: the MCP server communicates over the ACP channel itself via `mcp/connect`, `mcp/message`, and `mcp/disconnect`.

When implemented:

- Advertise `mcpCapabilities.acp` only after OMP can connect to `type: 'acp'` MCP servers.
- Route MCP messages through the ACP connection.
- Preserve existing stdio/http/sse behavior.
- Add cleanup on session close and connection abort.

Acceptance:

- Unit test: `type: 'acp'` server causes `mcp/connect` request.
- Unit test: stdio/http/sse behavior remains unchanged.

### F. Request cancellation

If the SDK exposes generic request cancellation:

- Track long-running agent-initiated ACP requests such as terminal wait, elicitation, and MCP-over-ACP calls.
- Handle cancellation notifications by resolving local waiters and cleaning up resources.
- Preserve `session/cancel` as prompt-turn cancellation; do not conflate request cancellation with prompt cancellation.

Acceptance:

- Unit test: request cancellation cleans up terminal/elicitation waiters.
- Unit test: prompt cancellation remains unchanged.

### G. Provider config, logout, and session delete

If the adopted SDK exposes provider-management, logout, or session-delete requests:

- Implement provider listing as a read-only view first. Do not mutate OMP provider configuration until the model registry exposes a safe write API.
- Map provider selection to the same model/provider state used by `SessionConfigOption` model selection.
- Implement logout only for providers where OMP can revoke or remove credentials through the existing auth store without corrupting unrelated config.
- Implement session delete only after defining whether deletion means removing the JSONL session file, derived artifacts, branch summaries, and cached title metadata. Delete must require permission.

Acceptance:

- Unit test: provider list reflects model registry state without exposing secret values.
- Unit test: unsupported provider mutation returns a method error rather than silently succeeding.
- Unit test: session delete is permission-gated and removes the selected stored session only.

### H. Next Edit Suggestions

If Next Edit Suggestions are supported by the SDK/client, treat them as an optional editor-proposed-edit path, not a replacement for OMP's direct edit tools.

- Use NES only when the user/client wants review-before-apply behavior.
- Do not mark an edit tool call `completed` until the client accepts or applies the suggestion.
- If the client rejects the suggestion, return a controlled tool result to the model and leave files unchanged.
- Keep direct edit behavior as fallback for clients without NES.

Acceptance:

- Unit test: accepted NES suggestion completes the corresponding tool call.
- Unit test: rejected NES suggestion does not write files and reports rejection to the model.
- Unit test: clients without NES keep current edit behavior.

### I. Agent telemetry export

If agent telemetry export is supported, expose read-only telemetry about the active session without leaking secrets or raw prompt content beyond what the protocol requires.

- Include session ID, cwd, model/provider IDs, usage totals, tool counts, stop reasons, and error summaries.
- Exclude API keys, environment variables, MCP credentials, and raw file contents.
- Gate export on client capability and user policy.

Acceptance:

- Unit test: telemetry export omits secret-shaped fields.
- Unit test: disabled telemetry capability returns method-not-found or unsupported.

### J. Diff-delete content

If the adopted SDK exposes finalized deleted-file diff content, use it for delete operations. Until then, represent deletion as a failed-safe text summary plus affected location, or as `newText: \"\"` only when the client renders that correctly.

Acceptance:

- Unit test: delete emits finalized delete diff shape when supported.
- Unit test: older SDK/client path emits clear text plus location.

## Data flow

### New session flow

1. Client calls `initialize` with capabilities.
2. OMP stores normalized `AcpClientState`.
3. Client calls `session/new` or `session/load`.
4. OMP creates `ManagedSessionRecord` with `AcpSessionServices` derived from `AcpClientState`.
5. OMP configures extensions with a per-session ACP UI bridge.
6. OMP configures MCP servers.
7. OMP emits bootstrap `available_commands_update` and `session_info_update`.

### Prompt/tool flow

1. Client calls `session/prompt`.
2. OMP converts prompt blocks, hydrating resource links through ACP fs when possible.
3. Agent begins normal turn.
4. On tool start, OMP emits pending `tool_call`.
5. Permission gate runs for sensitive tools.
6. Tool executes through ACP-backed adapter or direct fallback.
7. Event mapper emits rich content (`diff`, `terminal`, text/resource) and final status.
8. Prompt resolves with accurate `stopReason` and usage.

### Cancellation flow

1. Client sends `session/cancel`.
2. OMP marks prompt turn cancellation requested.
3. OMP cancels pending permission/elicitation waiters.
4. OMP kills/releases open ACP terminals.
5. OMP aborts the underlying session.
6. OMP resolves prompt response as `cancelled`.
7. OMP emits terminal failed/cancelled tool updates for any in-flight tool calls that otherwise would hang.

## Error handling

- Optional client methods must be capability-gated. Calling unsupported client methods is a bug.
- ACP client method failures should degrade to direct fallback only when fallback preserves correctness. For example, read fallback is acceptable for saved files but not for a resource link explicitly representing an unsaved buffer.
- Permission rejection is not an exception. It is a controlled tool result visible to the model and client.
- Terminal creation failure should fall back to direct execution only when policy allows command execution without editor terminal visibility. If the user/client requires terminal mediation, fail closed.
- `writeTextFile` failure must fail the tool and must not also attempt a direct write unless the failure is explicitly an unsupported-capability condition discovered before the call.
- Cleanup failures during terminal release should be logged and surfaced in debug output but must not mask the original tool result unless they leave a process running.

## Testing strategy

Add focused tests in `packages/coding-agent/test/` before or alongside implementation.

### Test doubles

Create a fake `AgentSideConnection` wrapper or client-service test double with call logs for:

- `readTextFile`
- `writeTextFile`
- `createTerminal`
- `requestPermission`
- elicitation methods when preview tests are enabled

Avoid network, real Zed, or real terminal process dependencies in unit tests.

### Required test files

- Extend `acp-agent.test.ts` for initialization, session services, permission, fs, terminal, plan mode, and prompt conversion.
- Extend `acp-event-mapper.test.ts` for diff and terminal content mapping.
- Add tool adapter tests near the affected tool/runtime modules if adapters are extracted from `acp-agent.ts`.
- Add regression tests that direct non-ACP mode behavior remains unchanged.

### Minimum verification commands for implementation branch

Run the smallest targeted commands first:

- `bun test packages/coding-agent/test/acp-agent.test.ts`
- `bun test packages/coding-agent/test/acp-event-mapper.test.ts`
- Targeted tests for modified tool/runtime files.

Before merge, run OMP's normal package gate for the affected repo. Do not claim Zed UI parity without an actual ACP/Zed smoke scenario or a protocol-level integration test.

## Rollout plan

### Phase 1: Foundation

- Store normalized client capabilities and client info.
- Add per-session ACP service container.
- Refactor `acpExtensionUiContext` into a factory without changing behavior yet.
- Add tests for capability storage and default unsupported behavior.

### Phase 2: File integration

- Add ACP-backed text file read/write adapters.
- Wire text read/write/edit paths through adapters.
- Hydrate `resource_link` prompt blocks.
- Add diff metadata for write/edit results.

### Phase 3: Permissions

- Add permission gate and session-scoped allow/reject memory.
- Wire sensitive tool kinds.
- Add cancellation cleanup.

### Phase 4: Terminal integration

- Add ACP terminal executor.
- Embed terminal tool content.
- Track/release terminals on cancel/close.
- Preserve direct fallback.

### Phase 5: User-visible ACP polish

- Accurate stop reasons.
- Plan mode config option.
- Dynamic command refresh.
- Unsupported content errors.

### Phase 6: Preview features behind gates

- Elicitation UI bridge.
- Terminal auth.
- Additional directories.
- Boolean config options.
- MCP-over-ACP.
- Request cancellation.

## Compatibility requirements

- Non-ACP modes must keep existing behavior.
- ACP clients that do not advertise filesystem/terminal capabilities must keep current direct execution behavior.
- Existing OMP session files must load and replay without requiring terminal IDs or new metadata.
- Existing MCP stdio/http/sse behavior must not regress.
- Existing `available_commands_update`, `session_info_update`, `usage_update`, and todo plan mapping must remain intact.
- No feature may silently reduce safety. If in doubt, fail closed and report a visible tool/client error.

## Open implementation questions to resolve during planning

These questions require code inspection while writing the implementation plan; they are not product ambiguities:

1. Exact old/new content fields emitted by `write`, `edit`, `ast_edit`, and `vim` results for generating ACP diff content.
2. Whether OMP's tool execution pipeline has a single async pre-execution hook suitable for the ACP permission gate, or whether adapters must be injected per tool.
3. Whether OMP's read/write tools already expose a runtime abstraction that can host `ClientFileSystemAdapter` without broad refactoring.
4. Exact session state flags used by interactive plan mode so ACP mode toggles the same behavior.
5. Whether current locked ACP SDK version exposes preview methods needed for elicitation/additional directories/MCP-over-ACP, or whether the implementation branch must bump the SDK first.

## Acceptance criteria for the full implementation

The implementation is complete when:

1. `initialize` records client capabilities and all optional ACP client calls are gated by those capabilities.
2. Text reads and writes use Zed/ACP filesystem methods when available, with direct fallback where correct.
3. Local file `resource_link` prompt blocks are hydrated through ACP fs when possible.
4. Sensitive tools request ACP permissions and respect allow/reject/cancel decisions.
5. Bash execution can run through ACP terminals, shows terminal content to the client, and releases resources on every path.
6. File modifications emit ACP diff content.
7. Prompt responses use accurate stop reasons.
8. Plan mode is selectable through ACP config/mode surfaces.
9. Unsupported prompt content is explicit, not silent.
10. Tests cover ACP-enabled and ACP-disabled behavior for each feature.
11. Existing ACP lifecycle/session replay behavior remains compatible with old sessions.
12. Documentation no longer claims OMP uses Zed-backed fs/terminal/permissions unless the corresponding implementation is present.
