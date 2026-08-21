## Context

See `proposal.md` — Why. Four properties of the existing machinery shape the approach.

**The payload is copied wholesale.** `packages.personal-omp-plugin` sets `src = ./plugin` and installs with `cp -R . "$out"`, so new directories under `plugin/` ship without a derivation change.

**The verification pattern already exists here.** The `openspec-adapters` check copies the repository into a sandbox, runs `openspec update . --force` with `CI` and `OPENSPEC_TELEMETRY` set, and diffs the result against the tracked adapters. `nix-darwin` runs the same check against its own copies. Only the compared paths need to change.

**The generator writes to a project root, not to an arbitrary directory.** `openspec update <dir> --force` regenerates `<dir>/.omp/commands` and `<dir>/.omp/skills` for the tools it detects. It has no option to emit into `plugin/`, so the payload has to be produced from generator output rather than by pointing the generator at it.

**Propagation is not local.** The plugin reaches a session as a `/nix/store` path chosen by `~/.config/nix-darwin`'s lock. A commit here changes nothing on the workstation until that lock moves and the configuration is rebuilt.

## Goals / Non-Goals

**Goals:**

- One tracked copy of the workflow, reproducible from a pinned generator.
- Coverage that survives a formatter, so the reproduce-and-diff check keeps its meaning.
- A rollout ordered so no repository loses the workflow before the replacement is installed.

**Non-Goals:**

- Editing generator output. The adapters ship as produced, including the overlap between a command and its paired skill.
- Choosing which repositories use OpenSpec. Repositories keep their own `openspec/` directories and decide independently.
- The `AGENTS.md` and `.claude` migration in `ancient-kingdoms-mods`, which is a separate follow-up.

## Decisions

### The payload, not the user agent directory

OMP resolves skills and commands from a user directory (`~/.omp/agent/skills`, `~/.omp/agent/commands`) as well as from plugin roots. The user directory is the smaller change and the wrong home: it is mutable, unversioned, and invisible to review, so nothing would prevent the copies drifting again and nothing would tie them to the generator that produced them.

The payload is immutable, built from a flake input, and already carries the personal policy and personal skills for exactly this reason. Putting the adapters beside them makes one lock govern the CLI and its generated instructions together.

Alternatives considered:

- **`~/.omp/agent/`.** Rejected: unversioned and unreviewable; reintroduces the drift it is meant to remove.
- **Leave the copies and add a check to every repository.** Rejected: it is the current state, and it scales the guard with the number of repositories rather than removing the cause.
- **A registered OpenSpec store.** Rejected: stores relocate specs and changes, which are repository content. Only the adapters are machine-level.

### Ship commands as well as skills, unmodified

Each generated command duplicates most of its paired skill — measured as line sets, `opsx-apply` and `openspec-apply-change` share 122 lines with one line unique to the command — and any discovered skill already registers a `/skill:<name>` command. Shipping only the skills would be a smaller payload.

It would also mean the payload is no longer the generator's output, and the freshness check degrades from "reproduces exactly" to "reproduces the subset we chose to keep". The check is the reason this design works, so the payload ships what the generator produces. `/opsx-*` remains the established entry point.

### Payload generation is a sync step with its own check

Because the generator only writes to a project root, the payload is produced by generating into a scratch root and copying `commands/` and `skills/openspec-*/` into `plugin/`. That is a script in this repository, mirroring `openspec update . --force` followed by a copy, and it is the only sanctioned writer of those paths.

The existing `openspec-adapters` check then compares payload against a fresh generation, so a stale payload and a hand-edited payload fail identically.

Alternatives considered:

- **Keep generating into `.omp/` here and symlink into the payload.** Rejected: two locations again, and `cp -R` would resolve or break the link depending on how the derivation copies it.
- **Commit the payload by hand after running the generator.** Rejected: unrepeatable, and the check would be the only thing keeping it honest.

### The formatter is excluded from the payload explicitly

`lefthook.yml` runs biome over staged `*.{ts,js,json,md}` files. The payload happens to escape today because `biome.json` includes only root-level `*.md`, which is an accident of a glob rather than a decision.

`HotRepl` and `ardenfall-compendium` show what happens when that accident does not hold: their adapters are permanently divergent because `dprint` and `prettier` respectively rewrite them. So the exclusion becomes explicit and commented, and the freshness check is what proves it holds.

### One change owns the rollout across repositories

The cross-repository architecture document states that it does not own repository implementation tasks, and that an active change in the affected repository owns them. That convention fits work with repository-specific content. Here the work in each consuming repository is the deletion of a directory that this change replaces, and its correctness depends entirely on this change's ordering.

Nine changes would restate one decision nine times and still need a coordinator. So the rollout stays here, and the architecture document records the decision rather than the tasks.

`ancient-kingdoms-mods` is the exception worth naming: it has an active `setup-openspec-workflow` change whose first two task groups added the tracked adapters and a per-repository check. Those are reverted here, and that change is rescoped by its own repository rather than edited from this one.

### The payload exposes two scoped roots, because the two loader flags are complementary

Measured against OMP 17.3.3 with the built payload:

| capability | `--extension <payload>` | `--plugin-dir <payload>` |
| --- | --- | --- |
| personal and workflow skills | yes | yes |
| personal policy rules | yes | yes |
| `personal_commit` extension | yes | no |
| `lsp.json` overrides | no | yes |
| workflow commands | once, unprefixed | once, prefixed with the store directory name |

Neither flag is sufficient alone, so the wrapper passes both. Pointing both at the same root registers every workflow command twice, once cleanly and once under a name derived from the `/nix/store` path, because the plugin registry scans `<root>/commands` and the extension loader scans the same directory.

The payload therefore exposes the LSP overrides in their own `lsp/` root. The wrapper loads the package root as an extension and that subdirectory as a plugin, so each flag supplies only what it alone provides. A root holding nothing but `lsp.json` is a valid plugin root, verified against the same build.

Alternatives considered:

- **Accept the duplicates.** Rejected: six entries named after a store hash appear in every completion list on the workstation, and the cause is a mismatch we control.
- **Drop `--plugin-dir` and place `lsp.json` in the user agent directory.** It works, and `~/.omp/agent/lsp.json` is the documented user-wide location with higher precedence than a plugin root. Rejected because the plugin exists to load without mutating OMP-owned state, and this would write into it. The requirement could be revised, but nothing here justifies it when a scoped root achieves the same result.
- **Ship skills without commands.** Rejected: it removes the duplicate by removing the feature, and `/opsx-*` is the established entry point.

### Deletion is gated on observed availability, not on a merged commit

The rollout removes the copies only after a session started through the personal wrapper resolves the commands and skills from the installed plugin. Until `nix-darwin`'s lock moves and the configuration is rebuilt, the payload exists only in this repository.

The command-naming question is settled by observation rather than by reading. Against the built payload, `--extension` registers each command once as `/opsx-*`, a project command of the same name overrides it, and `skill://openspec-propose` resolves in a directory that tracks no adapters. The registry path is what produced prefixed names, and the scoped roots above remove it.

## Risks / Trade-offs

- **Plugin commands turn out to be namespaced** → The gate above catches it before any repository loses its copy. If they are prefixed, the options are to accept the prefix or keep commands per repository while skills centralize. The deletion step does not proceed on an assumption.
- **A checkout is used without the personal wrapper** → The workflow is absent, and the CLI still works. These are personal repositories, and the wrapper is how the workstation runs OMP; `ardenfall-compendium` is the only one where a second user is plausible.
- **A repository genuinely needs a different workflow version** → It can override by name, which is the documented precedence and is unchanged by this work.
- **The rollout stalls half-applied** → Each repository is independent: a repository that still tracks copies keeps working, because a project adapter overrides the plugin's. The end state is uniform, and an interrupted rollout is merely mixed.
- **The freshness check needs the generator in CI** → It already runs as a flake check with `openspec` from the same locked input, so nothing new is required.

## Migration Plan

The payload ships first, the copies are removed last:

1. Payload built and verified in this repository.
2. `~/.config/nix-darwin` advances `personal-omp-plugin` and rebuilds.
3. Availability observed in a session started through the wrapper.
4. Copies removed from the nine roots, one commit each.

Rollback is per stage. Before stage 4 the copies are still present and authoritative, so reverting this repository restores the previous state exactly. After stage 4, restoring one repository's copies is a revert of that repository's deletion commit, which is why the deletions are not batched into a single commit.
