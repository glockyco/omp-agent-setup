# AGENTS.md

Source repository for the personal [Oh My Pi](https://github.com/can1357/oh-my-pi) plugin. It is the `glockyco` marketplace and publishes one plugin, `personal@glockyco`, which every host installs and upgrades with OMP's plugin manager. Hosts own OMP, language servers, Plannotator, the Bitwarden CLI, and their own OMP state.

## Setup

Use host-owned Git, Bun selected by `.bun-version`, Node and Python selected by `.github/workflows/ci.yml`. Native Windows uses Git for Windows and does not require Nix or WSL:

```sh
bun run check:toolchain
bun install --frozen-lockfile
bun x --no-install lefthook install
python -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: -r requirements-dev.txt
```

Select the workflow's Python as `python` before creating the venv. In PowerShell, use `& .\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements-dev.txt` for the wheel installation. No separate `py` launcher is required. Check `$LASTEXITCODE` after native commands. `PYTHON_BIN` can select an explicit interpreter. Otherwise launchers use the platform's `.venv` interpreter. `requirements-dev.txt` declares Windows terminal and process-ownership development tooling. Nothing installs global tools or changes user PATH. .NET SDK and actual language servers are host prerequisites only for relevant runtime capabilities.

## Source layout

- `.omp-plugin/marketplace.json`: the marketplace catalog. Its `personal` entry carries the release version and delivers the LSP overrides through `lspServers`.
- `plugin/`: the complete runtime payload that the plugin manager copies into its cache. Nothing else belongs in it.
- `plugin/package.json`: the OMP extension manifest. Its version must equal the catalog entry's.
- `plugin/extensions/`: dependency-free runtime extension source.
- `plugin/skills/` and `plugin/rules/`: personal behavior loaded by OMP.
- `plugin/commands/` and `plugin/skills/openspec-*/`: the generated OpenSpec workflow. Every repository loads this one copy; the marketplace exposes the commands as `/personal:opsx-*`. Write it only with `bun run sync:openspec-adapters`. `biome.json` excludes it because the freshness check reproduces it byte for byte. Do not rename the generated files or add bare-name aliases.
- `plugin/lsp/lsp.json`: minimal differences from the pinned OMP defaults.
- `tests/`: Bun and Python behavior tests, the release-tree tests, and `release_gate.py`, the isolated install, discovery, and upgrade gate.
- `scripts/`: release-tree validation and the release-version check.
- `openspec/specs/`: accepted behavior contracts.
- `openspec/changes/`: active and archived OpenSpec changes.

## Planning

Use OpenSpec for permanent behavior changes. Read `openspec/specs/` before changing a capability. Create one change for a new contract, validate it with `openspec validate <change> --strict`, and include its completed archive and accepted specs in the implementation pull request.

Do not restore `omp-plans`, a global planning hook, or repository-level instructions that call one.

This repository owns the generated OpenSpec workflow for every repository on the workstation. Regenerate with `bun run sync:openspec-adapters`, then review and commit the generated diff. Synchronization also refreshes the reusable-workflow and documented offline-hook version mirrors from the root npm dependency, because those boundaries must select the same CLI. `bun run check:openspec-adapters` checks mirrors and exact adapter bytes without changing the checkout. Do not hand-edit generated adapters, run `openspec init` in consuming repositories, or track adapters there. Consumers keep their own `openspec/` artifacts.

The portable artifact-validation definition is `.github/workflows/openspec.yml`. Consumers call it at the job level as `glockyco/omp-agent-setup/.github/workflows/openspec.yml@<reviewed full release SHA>`, optionally with repository-relative `openspec-root` (default `.`). They do not select a CLI version, copy its CI implementation, add a consumer CLI dependency or check this repository's adapters. README contains the exact YAML and offline POSIX/PowerShell host-local hook commands, including version parity, archive guard, telemetry disablement and exit propagation. Local hooks may contain that documented host-owned CLI sequence, not a private validator or downloader.

The retained `lib.openspecCheck` remains usable through existing locks:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

When adopting the workflow in nix-config, phd-thesis or test-generalization, record the reviewed full workflow SHA, migration evidence and removal of external adapter-freshness wiring. Flake/input removal and central-target deregistration require all three completed migrations in a later change. Do not delete the interface here.

Preserve the writing skill's support assets, upstream MIT license and `add-research-paper-writing-skill` rights record.

## Runtime boundaries

The payload must be self-contained. It must not:

- write to `~/.omp` outside `~/.omp/vault/`, which belongs to the vault extension;
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

### Vault

No secret value may appear in the `vault` tool's arguments or results, and the extension never rewrites another tool's arguments to contain one, because OMP saves revised arguments in the session. Keep the redaction hooks synchronous plain string replacement without I/O, because OMP lets a request through when a hook throws or times out. Passwords, codes and keys reach `bw` through child-only environment variables, never through arguments or the conversation.

### Research evidence

Keep computer-science evidence work primary and source precedence deterministic. Validate downloaded PDF bytes. Require an explicit Unpaywall identity. Repository bibliography conventions override skill defaults. Never fabricate a citation or infer metadata from memory when an authoritative source is available.

### Language servers

OMP's built-in catalog is the base. Add an override only when a representative scenario fails without it and passes with it. Hosts, not this repository, own server executables. Keep one primary server per language through executable availability.

## Checks

Run the complete native gate before release:

```sh
bun run ci
```

The native gate retains formatting, types, dead code, production audit, release tree/version, coverage, behavior, real hooks, toolchain parity, adapter freshness, strict active/archive validation and installed-release checks. Pull requests changing only files under `openspec/` or Markdown files (`.md` or `.markdown`) skip the three native gates while retaining their required check names and the shared OpenSpec validation. Other changes and non-PR events run all three native gates. Classification failures fail the native checks. The workflow also runs a separate Nix OpenSpec job. Require every applicable context for all actors, including administrators and automation, because native npm success does not establish Nix generator parity. Keep force-push and deletion disabled.

Pre-push `check:local` selects deterministic `*.unit.test.ts` through `check:test:unit`. Real OpenSpec/commitlint/lefthook/Git commands, compiled launchers and CLI entrypoints are `*.integration.test.ts`, with 30 s case budgets, and run in CI rather than pre-push. `check:test` runs both sets together with the unchanged per-file 80% coverage floor; the installed-cache runtime selector retains both runtime suites and explicit coverage. Do not reclassify or skip real-process scenarios merely to make a loaded workstation's hook timing deterministic.

The Python installed-release gate uses an absolute OMP v18.8.7 downloaded from its fixed host-asset URL and verified against the reviewed six-platform `.omp-version` JSON pin before execution, without runtime metadata/API, authentication token, installer or user PATH/registry changes. Every HOME/USERPROFILE/APPDATA/LOCALAPPDATA/temp/XDG root is isolated. Partial setup removes its own state; final CI cleanup runs after successful setup even if later gates fail. It tests real marketplace install, fresh commands/skills/rules/tools, terminal-observed LSP selection, installed-cache Bun/Python behavior, damaged candidates, upgrades, disabled/settings state and forward rollback. CI's official binary never replaces Korolev's Tern-managed OMP; fixtures prove selection/behavior, not real LSP protocol or browser acceptance.

Resolve owned scratch roots through filesystem realpath before deriving fake HOME and state paths; keep candidate work/release directories beneath that home. Preserve empty pre-install and exactly-once owned-manager assertions even for Windows short names or symlink/junction roots. Do not fix leaked or duplicate discovery with an output filter, extra config marker or host override.

LSP observation must include every probe that the scenario requires before judging selection. Independent servers can start at different times, so the first server's settle window does not prove the remaining required servers have started. Preserve the same bounded deadline and all unexpected-server assertions.

The full `nix flake check` verifies compatibility for retained flake consumers. CI also builds the platform-independent Nix OpenSpec version, adapter and contract checks. Keep `lib.openspecCheck` operational and source every Nix OpenSpec execution from the repository-owned package, not the `llm-agents` input, so unrelated lock updates cannot select another generator.

Install hooks explicitly with `bun x --no-install lefthook install` after frozen installation. Use Bun's built-in `x` subcommand, not an optional `bunx` executable alias. Hooks run installed native tools without Nix or downloads: staged formatting/types on commit, authoritative commitlint on the message, and frozen install plus `bun run check:local` on push. The fast local gate covers toolchain, lint, types, dead code, release version, unit tests, adapter freshness and strict OpenSpec validation; it omits network audit and installed-release download/terminal checks. When selected by path classification, three-host CI runs the complete `bun run ci`, including both omitted checks. The Bun hook runner strips `git rev-parse --local-env-vars` names only from its child environment, never the parent.

A permanent behavior change needs an observable test that fails for a plausible regression. Do not test source text when the behavior can be executed.

## Dependency updates

Renovate owns JS dependencies other than OpenSpec, lockfiles, actions, Bun/mirror, Python setup and Windows terminal-support pins. `.bun-version` is the Bun selection and `constraints.bun` is its checked mirror. Update both and regenerate `bun.lock` with selected Bun. The maintainer owns the canonical npm OpenSpec dependency, because a pull request that changes only the dependency cannot pass. An OpenSpec update changes the root dependency, refreshes its Nix packaging lock and hashes, and runs the synchronization command before review and cross-system verification. The workflow and hook versions are generated mirrors, not separate updater targets. OMP tag-only automation is disabled. Update its tag and six digests through `bun run sync:release-omp -- vX.Y.Z`, then review every platform digest. Updates remain review-only and do not merge, publish or upgrade a host.

The protected `glockyco/dependency-automation` control plane owns retained Nix inputs through its short-lived GitHub App token. No App key or competing scheduler belongs here; Renovate's Nix manager stays disabled until a separately accepted flake removal deregisters the central target.

For native manual updates, edit reviewed pins, use the selected Bun to regenerate the lockfile, regenerate adapters when the generator changes, then run:

```sh
bun run check:toolchain
bun install --frozen-lockfile
bun run sync:openspec-adapters
bun run ci
```

The workstation repository's [dependency-update runbook](https://github.com/glockyco/nix-config/blob/main/docs/operations/dependency-updates.md) owns the cross-repository schedule and GitHub App credentials.

## Release

1. Prepare one pull request containing the runtime implementation, matching version bumps in `.omp-plugin/marketplace.json`, `plugin/package.json`, and the root `package.json`, and its completed archived OpenSpec change with accepted specs. Keep the version bumps in the same commit as the runtime change. Documentation-only changes need no runtime version bump.
2. Run the full native gate for runtime releases and obtain all applicable required CI contexts. For changed visual behavior, also perform actual host UI acceptance in fresh Tern-managed OMP sessions on Korolev and macbook-pro, because isolated capability probes do not observe that interface.
3. Use installed-release CI for routine candidate installation, fresh capability discovery, system-prompt rule checks and upgrade verification. Do not repeat routine release smoke or manually verify upgrades on each host.
4. With explicit authorization, merge the reviewed release pull request and create the immutable tag `vX.Y.Z` on its reviewed release commit. Do not create a separate archive pull request.

Host plugin upgrades run hourly through nix-config and are independent of release completion. The [README upgrade instructions](README.md#upgrade) remain available for manual use.

Roll back by publishing known-good content as a newer version. The plugin and OMP versions are independent: `omp update` never upgrades the plugin, and a plugin release never updates OMP.

## Commits

Use Conventional Commits with a useful body. The body explains why the change exists and the constraint or tradeoff that selected the implementation. Keep code, tests, and related specification changes in the same logical commit. Never push without an explicit user request.
