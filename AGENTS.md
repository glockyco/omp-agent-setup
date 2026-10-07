# AGENTS.md

Source repository for the personal [Oh My Pi](https://github.com/can1357/oh-my-pi) plugin. It is the `glockyco` marketplace and publishes one plugin, `personal@glockyco`, which every host installs and upgrades with OMP's plugin manager. Hosts own OMP, language servers, Plannotator, and their own OMP state.

## Setup

Use the pinned shell:

```bash
nix develop --command bun install --frozen-lockfile
```

Do not require a globally installed Bun, npm, Python, .NET SDK, or language server.

## Source layout

- `.omp-plugin/marketplace.json`: the marketplace catalog. Its `personal` entry carries the release version and delivers the LSP overrides through `lspServers`.
- `plugin/`: the complete runtime payload that the plugin manager copies into its cache. Nothing else belongs in it.
- `plugin/package.json`: the OMP extension manifest. Its version must equal the catalog entry's.
- `plugin/extensions/`: dependency-free runtime extension source.
- `plugin/skills/` and `plugin/rules/`: personal behavior loaded by OMP.
- `plugin/commands/` and `plugin/skills/openspec-*/`: the generated OpenSpec workflow. Every repository loads this one copy; the marketplace exposes the commands as `/personal:opsx-*`. Write it only with `nix run .#sync-openspec-adapters`. `biome.json` excludes it because the freshness check reproduces it byte for byte. Do not rename the generated files or add bare-name aliases.
- `plugin/lsp/lsp.json`: minimal differences from the pinned OMP defaults.
- `tests/`: Bun and Python behavior tests, the release-tree tests, and `release_gate.py`, the isolated install, discovery, and upgrade gate.
- `scripts/`: release-tree validation and the release-version check.
- `openspec/specs/`: accepted behavior contracts.
- `openspec/changes/`: active and archived OpenSpec changes.
- `docs/plans/archive/`: historical records from the retired mutable deployment system.

## Planning

Use OpenSpec for permanent behavior changes. Read `openspec/specs/` before changing a capability. Create one change for a new contract, validate it with `openspec validate <change> --strict`, and archive it after all checks pass.

Do not restore `omp-plans`, a global planning hook, or repository-level instructions that call one.

This repository owns the generated OpenSpec workflow for every repository on the workstation. Regenerate it with `nix run .#sync-openspec-adapters`, review the diff, and commit it. Do not run `openspec init` in a consuming repository, and do not track adapters there. A consuming repository keeps its own `openspec/` directory, because specifications and changes are repository content.

It also owns how those artifacts are verified. `lib.openspecCheck` is the one definition of that check, and every repository holding an `openspec/` directory consumes it:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

Do not write the validation commands into a consuming repository, and do not pin the OpenSpec CLI there. Both live here. Nothing detects a repository that gains `openspec/` later and never adopts the check, so list the roots and their adoption when one appears:

```bash
for r in ~/src/github.com/glockyco/*/ ~/.config/nix-darwin; do
  [ -d "$r/openspec" ] && printf '%s %s\n' "$(basename "$r")" \
    "$(grep -ql openspecCheck "$r/flake.nix" 2>/dev/null && echo consumes || echo UNVERIFIED)"
done
```

## Runtime boundaries

The payload must be self-contained. It must not:

- write to `~/.omp`;
- install or update OMP, language servers, Plannotator, providers, models, or services;
- include credentials, sessions, history, caches, logs, databases, tests, or development tools;
- depend on a mutable checkout, sibling repository, Homebrew package, or global package manager;
- patch installed OMP source;
- expose compatibility aliases for retired delivery paths or command names.

Delivery has one owner: the plugin manager. Do not reintroduce a wrapper, `--extension`/`--plugin-dir` loading, a Nix runtime package, or a copied user configuration for this plugin.

The personal extension uses only runtime APIs already available in OMP's Bun process. Add a runtime dependency only when the capability cannot be implemented clearly with those APIs.

## Capability rules

### Structured commits

`personal_commit` accepts structured `commit`, `amend`, and `preview` input. Keep Git hooks enabled. Never stage, push, bypass hooks, or run planning commands from the extension. Preview must not mutate the repository. Agents stage only task-owned changes and create local commits at coherent, verified checkpoints. A push requires an explicit user request.

### Research evidence

Keep computer-science evidence work primary and source precedence deterministic. Validate downloaded PDF bytes. Require an explicit Unpaywall identity. Repository bibliography conventions override skill defaults. Never fabricate a citation or infer metadata from memory when an authoritative source is available.

### Language servers

OMP's built-in catalog is the base. Add an override only when a representative scenario fails without it and passes with it. Hosts, not this repository, own server executables. Keep one primary server per language through executable availability.

## Checks

Run both gates before release:

```bash
nix develop --command bun run ci
nix flake check
```

`bun run ci` covers formatting, types, dead code, dependency advisories, the release tree and release-version signal, extension behavior, real Git hooks, and deterministic retrieval fixtures. `nix flake check` runs `tests/release_gate.py` with the locked OMP: real marketplace installation into a disposable profile, a fresh session's commands, skills, rule, tools, and language-server selection, the behavior tests against the installed cache, negative controls, and upgrades. It also checks adapter freshness and OpenSpec contracts. CI repeats both gates on `aarch64-darwin` and `x86_64-linux`.

Entering the devshell installs the hooks in `lefthook.yml`: formatting and types on commit, commitlint on the message, and the lockfile check plus `bun run ci` on push. Each job reaches its tool through `nix develop`, so a commit works from an editor or a GUI client.

A permanent behavior change needs an observable test that fails for a plausible regression. Do not test source text when the behavior can be executed.

## Dependency updates

Renovate owns JavaScript dependencies, `bun.lock`, and GitHub Actions. The protected `glockyco/dependency-automation` control plane owns all Nix flake inputs and uses a short-lived token from the dependency-updater GitHub App. This repository stores no App key and runs no local Nix scheduler. Renovate's Nix manager stays disabled. Neither updater merges changes.

Use native commands for a manual update:

```bash
nix flake update
CI=1 OPENSPEC_TELEMETRY=0 nix develop --command openspec update . --force
nix develop --command bun install --frozen-lockfile
nix develop --command bun run ci
nix flake check
```

The workstation repository's [dependency-update runbook](https://github.com/glockyco/nix-config/blob/main/docs/operations/dependency-updates.md) owns the cross-repository schedule and GitHub App credentials.

## Release

1. Raise the version in `.omp-plugin/marketplace.json`, `plugin/package.json`, and the root `package.json` in the same commit as any runtime change.
2. Run both local gates.
3. With explicit owner authorization, merge the reviewed release and create the immutable tag `vX.Y.Z`.
4. Install the published release into a disposable OMP profile and confirm its version and capabilities.
5. Upgrade hosts with `omp plugin marketplace update glockyco` and `omp plugin upgrade --scope user personal@glockyco`, then verify the changed capability in a fresh OMP session in Tern.

Roll back by publishing known-good content as a newer version. The plugin and OMP versions are independent: `omp update` never upgrades the plugin, and a plugin release never updates OMP.

## Commits

Use Conventional Commits with a useful body. The body explains why the change exists and the constraint or tradeoff that selected the implementation. Keep code, tests, and related specification changes in the same logical commit. Never push without an explicit user request.
