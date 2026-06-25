---
title: Hindsight + Codex Local Memory Integration Design
type: spec
status: abandoned
created: 2026-05-26
parent:
superseded_by:
archived: 2026-06-25
---

# Hindsight + Codex Local Memory Integration Design

## Purpose

Make this OMP agent setup repo able to run Hindsight locally with ChatGPT/Codex subscription authentication, then enable OMP's `hindsight` memory backend against that local service. The result should be boring to operate: one setup command, launchd-managed service startup, explicit health checks, no secrets committed to the repo, and clear failure messages when Codex or Hindsight is not ready.

This spec targets `~/Projects/omp-agent-setup`. It does not change OMP's upstream Hindsight client implementation; it configures and supervises the local service that OMP already knows how to use.

## Current state

- `src/config.ts` manages top-level OMP config keys and currently forces `memory.backend: "off"`.
- `config/config.yml.template` also documents `memory.backend: "off"`.
- `bun run bootstrap` writes managed config into `~/.omp/agent/config.yml`, symlinks managed global files, reconciles plugins, applies OMP patches, and manages Zed settings.
- There is no repo-owned way to install, start, stop, or diagnose a Hindsight service.
- OMP's installed coding agent already supports the Hindsight backend: `memory.backend = "hindsight"`, default `hindsight.apiUrl = "http://localhost:8888"`, tools `retain`/`recall`/`reflect`, first-turn auto-recall, auto-retain, subagent aliasing, compaction recall, and mental models.
- This workstation has Docker, but subscription-backed Codex auth is cleaner outside Docker because the service needs access to host Codex credentials.

## Research references

- Hindsight installation docs: Docker and bare-metal both support local development; `hindsight-api` serves the API on port 8888 and Docker's full image includes the control plane on 9999. The docs recommend a stable worker id for persistent workers. Source: <https://hindsight.vectorize.io/developer/installation>
- Hindsight configuration docs: API service defaults to embedded `pg0`, default host is `0.0.0.0`, LLM provider can be `openai-codex`, embeddings/reranker default to local models, authentication is optional but should be enabled for non-local exposure. Source: <https://hindsight.vectorize.io/developer/configuration>
- Hindsight model docs: `openai-codex` uses ChatGPT Plus/Pro via Codex login and reads Codex credentials without an OpenAI API key; intended for local personal development, not production/team service use. Source: <https://hindsight.vectorize.io/developer/models#openai-codex-setup-chatgpt-pluspro>
- OpenAI Codex auth docs: CLI supports ChatGPT subscription login and API-key login; ChatGPT login is the default for CLI; credentials are cached in `~/.codex/auth.json` or an OS credential store; file-based `auth.json` must be treated as a password. Source: <https://developers.openai.com/codex/auth>
- Apple launchd docs: per-user background services should be LaunchAgents under the user's `~/Library/LaunchAgents`; `Label` and `ProgramArguments` are required; `RunAtLoad` starts at load/login; `KeepAlive` controls restart behavior; stdout/stderr should be redirected to files for debugging. Source: <https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html>
- Hindsight Control Plane npm package: published as `@vectorize-io/hindsight-control-plane` with executable bin `hindsight-control-plane`. Source: <https://www.npmjs.com/package/@vectorize-io/hindsight-control-plane>
- pnpm `dlx` docs: fetches and runs a package without adding it as a dependency; exact package versions can be requested; pnpm v11 `dlx` honors project security and trust policy settings. Source: <https://pnpm.io/cli/dlx>
- pnpm `exec` docs: use `pnpm exec` for binaries already present in project dependencies. Source: <https://pnpm.io/cli/exec>
- uv tool docs: `uvx` runs Python tools in temporary isolated environments; `uv tool install` is for frequently used tools that need persistent executables on `PATH`, still isolated from project dependencies. Source: <https://docs.astral.sh/uv/guides/tools/>

## Approaches considered

### A. Documentation-only manual setup

Add README/AGENTS notes telling the operator to install Hindsight, run `hindsight-api`, and edit config.

- Pros: smallest change.
- Cons: brittle; no bootstrap/doctor visibility; launch state drifts; easy to forget localhost binding, Codex auth prerequisites, or memory backend config.

### B. Repo-owned bare-metal service manager

Add a small Hindsight service manager to this repo. It installs/runs `hindsight-api` as a per-user LaunchAgent, runs the Hindsight Control Plane through pinned `pnpm dlx` as a second localhost-only LaunchAgent, uses `openai-codex`, sets safe local defaults, updates managed OMP config, and adds doctor/verify checks.

- Pros: reliable local operation, fits existing bootstrap/doctor pattern, avoids Docker credential mounts, no API key required.
- Cons: adds Python, pnpm, and launchd lifecycle to a Bun-managed setup; must handle macOS-specific service management carefully.

### C. Docker-managed Hindsight

Manage `ghcr.io/vectorize-io/hindsight:latest` with Docker and mount Codex credentials into the container.

- Pros: Hindsight dependencies isolated; includes control plane UI.
- Cons: subscription auth is awkward; credential mounts are risky; full image is large; container must still be made localhost-only and persistent; Docker availability becomes part of OMP memory health.

## Decision

Use approach B: repo-owned bare-metal Hindsight service management with Codex subscription authentication and the Hindsight Control Plane enabled by default.

Docker remains an operator fallback, documented but not the managed path. API-key providers remain supported by Hindsight itself, but this repo's default local setup uses `HINDSIGHT_API_LLM_PROVIDER=openai-codex` so memory work consumes ChatGPT/Codex subscription entitlements rather than OpenAI Platform API billing. The control plane is useful enough to manage alongside the API, but it remains a UI over the local API, not a second memory backend.

## Non-goals

- Do not modify OMP's Hindsight backend code in `@oh-my-pi/pi-coding-agent`.
- Do not vendor Hindsight or Codex source code.
- Do not commit, generate, copy, or print Codex tokens, OpenAI API keys, or Hindsight API keys.
- Do not expose Hindsight beyond localhost by default.
- Do not make Docker the default managed path.
- Do not auto-delete existing Hindsight banks, memory data, Codex credentials, or launchd jobs not owned by this repo.
- Do not introduce a general service manager framework; implement only what Hindsight needs.
- Do not require the control plane for OMP memory operation; OMP only depends on the Hindsight API.

## Desired operator experience

Initial setup:

```bash
codex login
bun run hindsight:install
bun run bootstrap
bun run doctor
```

Daily operation:

```bash
bun run hindsight:status
bun run hindsight:ui
bun run hindsight:restart
bun run hindsight:logs
```

After setup, OMP should use:

```yaml
memory:
  backend: "hindsight"
```

OMP should continue to connect to `http://localhost:8888`, which is already its schema default. Hindsight itself must bind to `127.0.0.1`, not `0.0.0.0`.

The Hindsight Control Plane should be available at `http://127.0.0.1:9999` for browsing banks, memories, documents, operations, and mental models. It must also bind to localhost only.

## Configuration design

### Managed OMP config

Change managed OMP config from memory off to Hindsight on:

```ts
memory: {
  backend: "hindsight",
}
```

Do not initially add `hindsight` to `MANAGED_KEYS`. OMP defaults already provide the right local API URL and scoping defaults, and adding a managed top-level `hindsight` key would overwrite user-owned Hindsight settings wholesale because `mergeManagedConfig` currently replaces whole top-level keys.

If future work needs managed `hindsight.*` defaults, first improve `mergeManagedConfig` to support scoped/deep ownership so user secrets and advanced settings are preserved.

### Hindsight service environment

The LaunchAgent should set only non-secret environment variables:

```text
HINDSIGHT_API_HOST=127.0.0.1
HINDSIGHT_API_PORT=8888
HINDSIGHT_API_LLM_PROVIDER=openai-codex
HINDSIGHT_API_WORKER_ID=omp-hindsight-local
HINDSIGHT_API_LOG_LEVEL=info
```

Do not set `HINDSIGHT_API_LLM_API_KEY` for the default path.

Keep embedded pg0 storage in Hindsight's default location or an explicit user-owned local directory. The repo should not snapshot, back up, or delete Hindsight's database.

### Package execution policy

Use the lightest package mechanism that gives reliable startup:

- Prefer `pnpm` over `npm`/`npx` for JavaScript tools outside this Bun repo.
- Prefer `pnpm dlx <package>@<exact-version>` for external JS executables that do not need to become project dependencies.
- Use `pnpm exec` only for binaries already in this repo's dependencies.
- Do not use `npm install`, `npm -g`, `npx`, or `bun install -g` for the control plane.
- Do not run unpinned `@latest` executables from launchd.
- For Python, prefer `uvx` for one-off commands and `uv tool install` only when launchd needs a persistent executable that can start without a network/cache fetch.

## Service management design

Add a focused service module pair following repo conventions:

- `src/hindsight-service.ts`: pure planning and rendering logic.
- `src/hindsight-service-runtime.ts`: filesystem, process, `launchctl`, and tool installation adapters.

Add package scripts that call the existing Bun CLI, not ad-hoc shell snippets:

```json
{
  "hindsight:install": "bun run src/cli.ts hindsight install",
  "hindsight:start": "bun run src/cli.ts hindsight start",
  "hindsight:stop": "bun run src/cli.ts hindsight stop",
  "hindsight:restart": "bun run src/cli.ts hindsight restart",
  "hindsight:status": "bun run src/cli.ts hindsight status",
  "hindsight:logs": "bun run src/cli.ts hindsight logs",
  "hindsight:ui": "bun run src/cli.ts hindsight ui"
}
```

The `hindsight install` command should:

1. Resolve or install `hindsight-api` in a user-scoped tool location.
2. Resolve `pnpm` and preflight the pinned control-plane `pnpm dlx` command without adding it to this repo, global npm, or `~/.omp/tools/node_modules`.
3. Refuse to proceed if Codex subscription auth is not available.
4. Render LaunchAgent plists:
   - `~/Library/LaunchAgents/io.glockyco.omp.hindsight.plist`
   - `~/Library/LaunchAgents/io.glockyco.omp.hindsight-control-plane.plist`
5. Create `~/.omp/logs/` for service logs.
6. Load/bootstrap both LaunchAgents for the current GUI user.
7. Wait for `GET http://127.0.0.1:8888/` or another cheap API health endpoint to respond.
8. Wait for `GET http://127.0.0.1:9999/` to return an HTTP response from the control plane.
9. Print next steps: `bun run bootstrap`, open `http://127.0.0.1:9999`, then start a fresh OMP session.

### Installing `hindsight-api`

Preferred installer: `uv tool install hindsight-api`.

Rationale: the API is the long-running service OMP depends on, so launchd needs a persistent executable that can start without a package-resolution/network step. `uv tool install` creates an isolated Python tool environment without adding Python dependencies to this Bun repo. If `uv` is missing, fail with a clear instruction to install `uv`; do not fall back to global `pip install` silently.

The runtime layer should discover the absolute `hindsight-api` executable path after installation and write that absolute path into the LaunchAgent plist. LaunchAgents should not rely on an interactive shell `PATH`.

If a future Hindsight release has known-good version constraints for OMP, pin the `uv tool install` spec and report the installed version in `hindsight:status`.

### Running the control plane

Preferred runner: a pinned `pnpm dlx` invocation, not an npm install.

Use a source constant for the package spec, initially:

```text
@vectorize-io/hindsight-control-plane@0.6.2
```

Rationale: the control plane is an external JS executable, not a library this repo imports. `pnpm dlx` fetches/runs it without adding it to this repo's dependencies or creating a global npm install, and exact package versions keep launch behavior stable. `pnpm` is preferred over `npm`/`npx`; `bunx` is not the default here because the requested policy is pnpm-first for JS tooling and pnpm's `dlx` has documented security/trust-policy behavior.

The install command should preflight the pinned `pnpm dlx` command so the package is cached and the executable shape is validated, but it must not create a persistent `node_modules` tree or global package installation. The LaunchAgent should call the absolute `pnpm` executable with `dlx` and the pinned package spec.


### Codex auth detection

The install/doctor flow should validate Codex auth before starting Hindsight.

Checks:

1. `codex` executable exists.
2. Current Codex CLI supports subscription login.
3. File-based `~/.codex/auth.json` exists, or the CLI can prove an active login through a non-mutating status/auth command if available.

Because Hindsight's documented `openai-codex` provider says it reads `~/.codex/auth.json`, the first implementation should require file-based credentials unless direct testing proves Hindsight works with Codex keychain storage. If missing, print:

```text
Run `codex login` and ensure file-based Codex credentials are available at ~/.codex/auth.json.
Treat that file as a secret; this repo will not copy or commit it.
```

If the installed Codex version uses `codex auth login` instead of `codex login`, diagnostics may mention both, but repo docs should prefer the current OpenAI command `codex login`.

### LaunchAgent plist

Generated plist shape:

```xml
<dict>
  <key>Label</key>
  <string>io.glockyco.omp.hindsight</string>
  <key>ProgramArguments</key>
  <array>
    <string>/absolute/path/to/hindsight-api</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HINDSIGHT_API_HOST</key>
    <string>127.0.0.1</string>
    <key>HINDSIGHT_API_PORT</key>
    <string>8888</string>
    <key>HINDSIGHT_API_LLM_PROVIDER</key>
    <string>openai-codex</string>
    <key>HINDSIGHT_API_WORKER_ID</key>
    <string>omp-hindsight-local</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/.../.omp/logs/hindsight.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/.../.omp/logs/hindsight.err.log</string>
</dict>
```

Use `RunAtLoad` plus `KeepAlive.SuccessfulExit=false`, not unconditional `KeepAlive=true`, so launchd restarts crashes but does not fight intentional clean exits/unloads.

### Control Plane LaunchAgent plist

Generate a second LaunchAgent for the UI. It should be independent from the API process but configured to point at the API URL. It runs a pinned package executor, not a globally installed binary:

```xml
<dict>
  <key>Label</key>
  <string>io.glockyco.omp.hindsight-control-plane</string>
  <key>ProgramArguments</key>
  <array>
    <string>/absolute/path/to/pnpm</string>
    <string>dlx</string>
    <string>@vectorize-io/hindsight-control-plane@0.6.2</string>
    <string>--api-url</string>
    <string>http://127.0.0.1:8888</string>
    <string>--hostname</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>9999</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/.../.omp/logs/hindsight-control-plane.out.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/.../.omp/logs/hindsight-control-plane.err.log</string>
</dict>
```

The control plane is local-only by default. Do not set `HINDSIGHT_CP_ACCESS_KEY` for localhost-only use. If the UI is ever exposed beyond loopback, require an access key and Hindsight API auth in the same change. Because the plist uses `pnpm dlx`, status/doctor should report the pinned package spec and warn if pnpm is missing or the cache/preflight has not succeeded.

## CLI command behavior

### `hindsight install`

Idempotent. It may update either plist if rendered content changes. It must not overwrite unrelated LaunchAgents.

Output should include:

- path to `hindsight-api`
- absolute `pnpm` path and pinned control-plane package spec
- plist paths
- whether each plist changed
- launchctl actions taken
- API health result
- control plane URL and health result

### `hindsight start`

Loads/bootstraps the existing API and control-plane plists and waits for health. If either plist does not exist, fail and suggest `bun run hindsight:install`.

### `hindsight stop`

Boots out both owned LaunchAgents. It does not delete plists, Codex credentials, Python tools, Hindsight data, pnpm cache entries, or control-plane package data.

### `hindsight restart`

Stops, starts, then waits for health.

### `hindsight status`

Reports:

- plist present/missing
- launchctl running/not running
- API health reachable/unreachable
- OMP managed config target: `memory.backend=hindsight`
- Codex auth present/missing
- Hindsight API host binding expectation: `127.0.0.1:8888`
- control plane reachable/unreachable at `http://127.0.0.1:9999`

### `hindsight logs`

Prints the owned stdout/stderr log file paths and the recent log tail via Bun/Node file reads, not shell `tail`.

### `hindsight ui`

Checks that the control plane is reachable and opens `http://127.0.0.1:9999` with the platform opener. If opening fails, print the URL. This command should never start a browser in tests; the opener must be injected.

## Doctor and verify integration

Extend `bun run doctor` with a read-only Hindsight section when managed memory is set to `hindsight`:

- OMP config has `memory.backend=hindsight` after merge.
- Hindsight API is reachable at `http://127.0.0.1:8888`.
- The service is bound to localhost by expected config, not all interfaces.
- Codex auth is present.
- LaunchAgent is installed and owned by this repo if local service management was used.

Extend `bun run verify` only with deterministic checks that do not require a model-heavy retain/recall roundtrip by default. The verify path should check config rendering, plist rendering, command availability, and optionally API reachability. A full retain/recall smoke can be opt-in through an environment variable, for example:

```bash
OMP_VERIFY_HINDSIGHT_LIVE=1 bun run verify
```

This avoids making every verification run consume subscription limits or wait on Hindsight background consolidation.

## Security and privacy

- Bind the API to `127.0.0.1` by default. Hindsight's documented default host is `0.0.0.0`; this repo must override it for local personal use.
- Do not enable Hindsight API-key auth by default for localhost-only service. If a future change exposes the service beyond loopback, require Hindsight tenant API-key auth first.
- Treat `~/.codex/auth.json` as a password. Never copy it into this repo, backups, logs, artifacts, or generated config.
- Do not write OpenAI Platform API keys into LaunchAgent plists. The default Codex subscription path does not need them.
- Logs may contain startup errors and request metadata. Keep logs under `~/.omp/logs`, not inside the repo.
- Do not include Hindsight database files in repo backups.

## Documentation changes

Update `README.md` command table with the new Hindsight scripts once implemented.

Update `AGENTS.md` with a concise operational note:

- Hindsight is the managed memory backend.
- Edit source config/service management here, not deployed files.
- Use `bun run hindsight:status` and `bun run doctor` for diagnosis.
- Do not edit `~/.omp/agent/config.yml` or `~/Library/LaunchAgents/io.glockyco.omp.hindsight.plist` directly; change source/generator code and rerun setup.

Update `config/config.yml.template` to reflect the new managed memory backend.

## Tests

Add pure unit tests for:

- LaunchAgent plist rendering with absolute paths and localhost env.
- Idempotent service plan when plist content is unchanged.
- Service plan when plist content changes.
- Health status classification: reachable, connection refused, timeout, malformed response.
- Codex auth classification: executable missing, auth file missing, auth present.
- Managed config now sets `memory.backend=hindsight`.

Add runtime tests with injected fakes for:

- install command plans plist write and launchctl bootstrap.
- start/stop/restart call the expected launchctl operations.
- logs command reads bounded log content without shelling out to `tail`.

Do not add tests that require real Codex login, real Hindsight model calls, or network access by default.

## Rollout plan

1. Add pure service planning/rendering module and tests.
2. Add runtime service adapter and CLI subcommands with faked runtime tests.
3. Change managed memory backend from `off` to `hindsight`; update config tests and template.
4. Add doctor/status checks.
5. Update README and AGENTS operational notes.
6. Run focused unit tests for changed modules.
7. Manually run `bun run hindsight:install`, `bun run hindsight:status`, `bun run bootstrap`, and `bun run doctor` on the workstation.
8. Start a fresh OMP session and verify `/memory view` exposes Hindsight instructions and `retain`/`recall` tools are available.

## Acceptance criteria

- `bun run hindsight:install` installs or locates `hindsight-api`, resolves/preflights pinned `pnpm dlx` for the control plane, writes both owned LaunchAgents, starts both services, and reports a healthy local API plus reachable UI.
- The generated API service binds to `127.0.0.1:8888`, uses `HINDSIGHT_API_LLM_PROVIDER=openai-codex`, and the generated control-plane service binds to `127.0.0.1:9999`.
- No secret values are stored in tracked files or printed by normal commands.
- `bun run bootstrap` deploys managed OMP config with `memory.backend=hindsight`.
- `bun run doctor` clearly reports Hindsight/Codex readiness and actionable remediation when the service is down or auth is missing.
- Unit tests cover config merge changes, plist rendering, status classification, and command planning.
- Existing bootstrap/config tests are updated rather than weakened.
- The docs explain Codex subscription auth, localhost binding, the control plane, logs, start/stop/status/ui commands, and Docker as an unmanaged fallback.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Hindsight `openai-codex` provider only works with `~/.codex/auth.json`, while Codex may default to keychain storage. | Doctor requires file auth until direct testing proves keychain works. Docs explain that `auth.json` is secret. |
| Hindsight or Codex CLI command names change. | Detect commands at runtime and produce versioned diagnostics; keep install logic narrow and tested through fakes. |
| LaunchAgent starts without an interactive shell PATH. | Render absolute executable paths into plist. |
| Hindsight binds to all interfaces. | Always set `HINDSIGHT_API_HOST=127.0.0.1`; doctor checks expected local URL. |
| Retain/recall live smoke consumes subscription limits. | Keep full live smoke opt-in; normal verify remains deterministic. |
| Bootstrap forces Hindsight memory while service is missing. | Doctor reports the mismatch; install command is explicit. OMP backend failure remains non-fatal and memory tools surface clear errors. |
| Control plane package changes or network package execution at login create drift. | Use pinned `pnpm dlx`, preflight/cache it during install, avoid npm/global installs, and have status report the pinned package spec plus readiness. |

## Future work

- Add optional Docker fallback management only if bare-metal Codex provider proves unreliable.
- Add scoped/deep managed config ownership if this repo needs to manage `hindsight.*` keys without overwriting user-owned values.
- Add an opt-in live retain/recall smoke command once the local service is stable.
- Add Hindsight bank/template shortcuts in the control plane if daily maintenance reveals repeated manual navigation.
