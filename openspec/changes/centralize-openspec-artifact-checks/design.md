## Context

See proposal.md for the gap. What shapes the approach is the state of the nine roots:

| | flake | Nix in CI | protected |
|---|---|---|---|
| `omp-agent-setup`, `nix-darwin` | yes | yes | no |
| `erenshor-data-mining`, `HotRepl` | yes | yes | yes |
| `test-generalization` | yes | yes | no |
| `ancient-kingdoms-mods` | yes | no | yes |
| `ardenfall-compendium` | yes | no | yes |
| `phd-thesis`, `renovate-config` | no | no | no |

Five already run Nix in continuous integration, which makes adoption two lines there. Seven already have a flake.

Two measurements decided the rest. `nix flake check` in `ancient-kingdoms-mods` takes 0.76 seconds, so the gate is cheap enough to run anywhere. And the `openspec` packaged in Nixpkgs lags far behind the one `llm-agents` provides, far enough that its `validate` has no `--archived` flag at all. The free option cannot perform the check that motivated this work. Re-test with `openspec validate --help` rather than trusting this paragraph.

## Goals / Non-Goals

**Goals:**

- One definition of the verification, consumed by every repository holding OpenSpec artifacts.
- The same result locally and in continuous integration, from a pinned version.
- Remove the two hand-written copies rather than adding a ninth mechanism beside them.

**Non-Goals:**

- Leaving a repository broken. Where the gate finds defects, this change repairs them, because a gate that cannot be switched on is not adopted. `ardenfall-compendium` was the only such repository.
- Extending the shared flake to other checks. Formatting, linting and commit policy stay where they are. The output is shaped so a second check could join it later, and nothing more is claimed.
- Replacing any repository's hooks. A repository may invoke the gate from a hook for faster feedback, but the guarantee is the continuous integration run.
- Detecting a repository that gains `openspec/` later and never adopts the input. That needs cross-repository reads and a token this fleet does not have. See Risks.

## Decisions

### The verification is a flake output that repositories consume as an input

Nix already answers "define once, reference everywhere" for exactly this shape. The output is a function of the consumer's source, so one definition serves nine repositories with two lines each:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

Alternatives considered:

- **A reusable GitHub workflow.** Reaches every repository and needs no flake, and was the earlier draft of this change. Rejected because it must obtain the CLI in continuous integration, where the workstation profile does not exist. That means pinning `@fission-ai/openspec` from npm, a second source of the same tool beside the `llm-agents` pin, introduced days after the fleet finished deleting duplicate sources of the same workflow. It is also useless locally.
- **An executable shipped in the plugin payload, invoked by hooks.** One definition, one pin, and instant feedback. Rejected as the guarantee: hooks are per-clone state that four of the nine repositories never install automatically, `--no-verify` and rebases skip them, and a missing hook is silent. A missing flake output is visible in `flake.nix`.
- **A hand-written check in each repository.** What the two verified repositories do today. It is the duplication this change removes.

### The pinned CLI comes from `llm-agents`, not Nixpkgs

Nixpkgs would cost nothing to add, since every flake here already has it. Its build lags far enough behind that `validate` has no `--archived` flag, so it cannot check the exact condition that produced today's defect. The shared definition therefore takes the CLI from the `llm-agents` input this repository already uses, which is the same source the workstation installs from.

The check does not restate that as a claim. It asserts the flag is present before running the validations, so a CLI that drops `--archived`, from either source, fails the check rather than quietly verifying less than the spec requires.

Consumers inherit that pin through the shared flake. They never name an OpenSpec version, which is what keeps one version in play across the fleet and makes an upgrade a change here plus a lock bump there.

### The verification reads only `openspec/`

The existing check in this repository runs `cd ${./.}`, which copies the whole repository into the store. Applied to `phd-thesis` that would import a thesis and its build outputs to validate Markdown.

The shared definition narrows the source to the artifacts with a file set. That keeps the store small, and it means an unrelated commit does not invalidate the result, so the gate is usually a cache hit.

### `nix flake check` is the single invoker

Every repository runs it in continuous integration, which is the guarantee: it cannot be skipped by a flag, and its absence is visible in the workflow file.

Hooks stay where they already are. A repository may add a job that runs `nix flake check`, and at 0.76 seconds that is a reasonable pre-commit job, but no repository keeps a copy of the commands in its hook configuration. `HotRepl` and `test-generalization` already invoke Lefthook from continuous integration for other gates; that pattern is untouched and simply gains a sibling step.

### Two repositories get a check-only flake

`phd-thesis` and `renovate-config` have no flake, no package manifest, and no hook manager. They get a `flake.nix` that exposes this check and nothing else: no development shell, no formatter, no change to how a thesis or a Renovate preset is built. This is the cost the fleet accepts for one mechanism rather than two, and it is confined to one file plus a CI step in each.

### The shared output lives here, for now

This repository already owns the fleet's OpenSpec surface: its accepted spec makes the plugin the only tracked source of the workflow every repository loads, and it already pins the CLI. Placing the check beside the workflow it verifies keeps one owner.

A dedicated `fleet-checks` flake would give consumers a smaller closure and an obvious name. That becomes the better answer when a second shared check appears, and moving the output later is a rename in nine locks. `renovate-config` is precedent that a small single-purpose shared repository is acceptable here.

## Risks / Trade-offs

- **Every consumer now depends on this repository resolving.** → The input is source only, locked and cached, so offline runs work after the first fetch. A repository can pin a commit and stay on it.
- **Nine locks can hold nine versions.** → The definition stays single; only the version can lag, and it lags visibly in a lock file that `nix flake update` and Renovate already manage. This is ordinary dependency drift, not a second implementation.
- **`ardenfall-compendium` may fail on adoption.** → Its 24 artifacts have never been validated. Its task runs the check before the input lands, so the repair is scoped rather than discovered by a red default branch.
- **Four continuous integration pipelines gain a Nix installation.** → Roughly a minute each, with a cache. Two of those repositories already had a flake and were only missing the runner step.
- **A repository could gain `openspec/` and never adopt the input.** → Recorded as a documented sweep over the checkouts in the closing tasks, not as automation that does not exist.
- **Three default branches require pull requests.** → `HotRepl`, `erenshor-data-mining` and `ardenfall-compendium` adopt through a pull request. Their tasks say so.

## Migration Plan

1. Add the shared output here and prove it fails on both conditions before any repository consumes it.
2. Convert this repository and `nix-darwin` first, deleting their hand-written checks. If the shared output cannot reproduce what they already assert, that is known before eight other repositories depend on it.
3. Adopt in the repositories that already run Nix in continuous integration, then those needing the runner step, then the two that need a flake.
4. Confirm no repository holds the commands any more, and record the covered set.

Rollback is per repository and is the removal of one input and one line. The two converted repositories can restore their previous check from history.
