# Design

## Context

See proposal.md for motivation. The reusable workflow is self-contained because callers check out their own repositories. The local check extracts its inline script, and only OpenSpec artifacts enter its scratch copy.

## Goals / Non-Goals

Validate archive-produced specs without changing the installed plugin or requiring caller dependencies. Existing archived-task validation still examines actual archived changes, not incomplete development tasks temporarily archived during simulation.

## Decisions

Use a second named workflow step with the same anchored inline script and an internal prospective-validation environment flag. This keeps root containment, scratch ownership, CLI invocation and cleanup in one definition. The local harness executes both modes, so integration tests exercise exactly what callers receive.

Copy only the repository's OpenSpec artifact tree into an owned scratch root. In prospective mode, obtain active names with `openspec list --json`, archive each sorted name with `--yes`, then run `openspec validate --specs --strict --no-interactive`. Do not validate simulated archives for task completion because active tasks can legitimately be unfinished. Retain active and real-archive checks in the first mode.

Materialize linked artifact contents in the copy, because preserving a symlink would let archive write through it into the checkout. A junction-based regression covers this boundary on native Windows as well as Unix.

Test an overlong requirement that passes delta validation, valid multiple changes, an archive error and the no-open-change path. Compare all source artifact bytes before and after. Run the candidate workflow on current main artifacts from every live caller, discovered through repository trees when GitHub code search is empty.

README explains the new shared CI guarantee and that the short offline hook commands do not simulate archive.

## Risks / Trade-offs

Open changes that cannot archive together fail rather than silently validating a subset. Sorting change names makes the simulation deterministic. The scratch-only archive may print unfinished-task warnings, but real archived-task completeness remains independently enforced.

## Verification

On 2026-11-01, the throwaway MODIFIED requirement passed `validate --all --strict --no-interactive` and archive, then failed `validate --specs --strict --no-interactive` with the over-500-character warning. The permanent regression also verifies unchanged source artifact bytes. ADDED requirements already receive this length warning during delta validation, so the control uses MODIFIED to reproduce the actual gap.

GitHub code search returned zero results, including a known-repository control. A direct tree/blob scan of 75 active repositories, excluding ancient-kingdoms-mods, found two external callers. The candidate workflow passed nix-config's 20 specs and 60 archives. It initially rejected obsidian-workbench's existing overlong full-spec requirements, which were shortened without behavioral changes in [obsidian-workbench#17](https://github.com/glockyco/obsidian-workbench/pull/17). The candidate then passed all 16 specs and 32 archives there. Neither caller had open changes, covering the unchanged-spec path.

The linked-spec regression exposed that Node 24.21.0's synchronous copy preserved a directory link despite `dereference: true`. A standalone control reproduced that behavior, while asynchronous `cp` materialized the same link. The workflow uses the asynchronous copy and keeps the cross-platform regression.

One native installed-release run reached the provider chooser instead of starting the expected Markdown servers. Both existing LSP probes remained strict, and the observed unrelated failure is recorded in [#123](https://github.com/glockyco/omp-agent-setup/issues/123).
