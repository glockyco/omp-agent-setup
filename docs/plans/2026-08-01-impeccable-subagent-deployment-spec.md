---
title: Impeccable Subagent Deployment Spec
type: spec
status: draft
created: 2026-08-01
parent: 2026-07-31-setup-maintenance-overview
superseded_by:
archived:
---

Impeccable's four shipped subagents are unreachable under OMP because the upstream Pi variant carries no agent definitions, so this repository vendors them from the Claude variant, translates their front-matter into OMP's agent schema, and deploys them through a fourth managed registry.

## Finding

The upstream universal bundle (`https://impeccable.style/api/download/bundle/universal`) ships four agent definitions to some harnesses and none to others. Counted from the bundle on 2026-08-01, excluding the `openai.yaml` provider file that sits beside the TOML definitions:

| Variant | `skills/impeccable/agents/` | `<harness>/agents/` |
|---|---:|---:|
| `.pi` (what we vendor) | 0 | 0 |
| `.claude` | 0 | 4 |
| `.codex` | 4 | 0 |
| `.agents` | 4 | 0 |
| `.cursor`, `.opencode` | 0 | 0 |

`src/impeccable-update.ts` copies `.pi/skills/impeccable` faithfully, so there is nothing to vendor and nothing is being dropped. The gap is upstream's Pi packaging, not this repository's vendoring.

The four agents and where the vendored skill instructs the model to spawn them:

| Agent | Referenced by | Role |
|---|---|---|
| `impeccable-finish-reviewer` | `reference/new-work.md` §7 | Fresh-context review of a finished build against its direction contract |
| `impeccable-documenter` | `reference/new-work.md` §7 | Writes `DESIGN.md` and its sidecar from the built artifact |
| `impeccable-asset-producer` | `reference/visualize.md` | Renders the per-card sketches for the direction decision page |
| `impeccable-manual-edit-applier` | `reference/live.md`, `scripts/live/instructions.mjs` | Applies leased live copy-edit batches |

`new-work.md` §7 names an in-thread substitute at `reference/degraded/finish-reviewer.md` and `reference/degraded/documenter.md`. No `degraded/` directory exists in any variant of the bundle, so a Pi-variant run has neither the agent nor the documented fallback text. That is an upstream inconsistency to report rather than something this repository can vendor around.

OMP discovers user agents at `~/.omp/agent/agents/` — the default target of `omp agents unpack`, resolved in `src/cli/agents-cli.ts` of `@oh-my-pi/pi-coding-agent`. That directory does not currently exist.

## Design

### A fourth managed registry

The three existing registries in `AGENTS.md` gain a sibling, following the same shape so nothing new has to be learned:

| Registry | Payload | Deployed at |
|---|---|---|
| `src/managed-agents.ts` | `agent/agents/<name>.md` | `~/.omp/agent/agents/<name>.md` — symlink |

`LOCAL_MANAGED_AGENTS` names the four agents. Bootstrap snapshots and links them exactly as it does skills and rules, and `managedAgentChecks` reports each one.

The payload files are generated, not hand-written. They land in `agent/agents/` during `bun run update-impeccable` so a re-vendor refreshes them, and they are committed so the tree is reviewable and bootstrap never depends on a network fetch.

### Front-matter translation

`.claude/agents/*.md` is the source because it is Markdown with YAML front-matter, the same container OMP uses, so only the front-matter needs rewriting and the body copies verbatim. The `.codex`/`.agents` TOML files would need a format conversion as well as a schema one.

The two schemas differ in every key except `name` and `description`:

| Claude key | Example | OMP key | Rule |
|---|---|---|---|
| `name` | `impeccable-finish-reviewer` | `name` | unchanged |
| `description` | prose | `description` | unchanged, emitted quoted |
| `tools` | `Read, Bash, Glob, Grep` | `tools` | comma string to list, lowercased, `yield` appended |
| `model` | `inherit` | — | dropped: OMP has no model sentinel meaning inherit, and omitting the key is what leaves resolution to the session |
| `effort` | `high` | `thinkingLevel` | value passes through |
| `maxTurns` | `30` | — | dropped: OMP has no per-agent turn ceiling |

Tool names map one to one (`Read`→`read`, `Write`→`write`, `Edit`→`edit`, `Bash`→`bash`, `Glob`→`glob`, `Grep`→`grep`). `yield` is appended because every bundled OMP agent that declares `tools` carries it. An unrecognised Claude tool name is a hard error rather than a silent drop, so an upstream addition surfaces at vendor time instead of as a subagent that cannot do its job.

`thinkingLevel` values are checked against OMP's vocabulary — `inherit`, `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max` (`ThinkingLevel` in `@oh-my-pi/pi-agent-core/src/thinking.ts`) plus the `auto` sentinel. Upstream currently uses `high` for the finish reviewer and `medium` for the other three, all valid.

Translation therefore yields:

| Agent | `tools` | `thinkingLevel` |
|---|---|---|
| `impeccable-finish-reviewer` | read, bash, glob, grep, yield | high |
| `impeccable-documenter` | read, write, bash, glob, grep, yield | medium |
| `impeccable-asset-producer` | read, write, edit, bash, glob, grep, yield | medium |
| `impeccable-manual-edit-applier` | read, write, edit, bash, glob, grep, yield | medium |

The finish reviewer keeps no write or edit tool. Its own instructions say it edits nothing and the parent applies its fixes, so the read-only tool set is load-bearing rather than incidental.

### No output schema

The translated front-matter must not gain an `output:` block. The skill expects the reviewer to return five prose sections, and OMP's structured-output path is a known failure mode here: spawning this review against a schema-carrying agent returned a 49-byte envelope containing `{"draft":{"review":"see sections"}}` and no review at all, and the same work returned 26 KB of usable findings once an explicit schema was supplied per invocation instead. Callers that want structure pass `outputSchema` on the spawn, where it is theirs to shape.

### Why not the alternatives

Deploying `.claude/agents/*.md` unmodified fails: `tools: Read, Bash, Glob, Grep` is a string where OMP wants a list, and the capitalised names match no OMP tool.

Hand-writing the four agents in `agent/agents/` fails the boundary in `AGENTS.md` that Impeccable content is never authored locally — it would silently diverge on the next upstream release with nothing to detect the drift.

Carrying the translation as an `IMPECCABLE_VENDOR_FIX` fails because vendor fixes are anchored text patches inside the vendored skill directory, and these files live outside it and need a structural rewrite rather than an anchor replacement.

## Acceptance

- `bun run update-impeccable` writes exactly four files to `agent/agents/`, each parsing as YAML front-matter plus body, and reports them alongside the existing per-fix status.
- An unrecognised Claude tool name, an unknown `effort` value, or a missing `.claude/agents` directory in the bundle fails the update with a message naming the file and the offending value.
- Re-running `bun run update-impeccable` on an unchanged bundle produces no diff in `agent/agents/`.
- `bun run bootstrap` creates `~/.omp/agent/agents/` and symlinks all four; running it twice is a no-op.
- `bun run doctor` prints `ok <name>.md -> <repo path>` for each of the four and stays `healthy`.
- A fresh OMP session lists `impeccable-finish-reviewer` among its available agents, and spawning it returns prose rather than an empty envelope.
- `bun run ci` passes, including the 0.8 coverage threshold on the new pure logic.

## Boundaries

The `degraded/` references in `new-work.md` stay broken. They are upstream's to fix, and inventing local fallback text would be exactly the divergence the vendoring boundary exists to prevent.

`impeccable-asset-producer` is only reachable when image generation is available, and `impeccable-manual-edit-applier` only from the live editing flow. Both are deployed for completeness, and neither is expected to appear in a routine session.
