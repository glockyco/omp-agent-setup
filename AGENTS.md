# AGENTS.md

Source repository for the personal [Oh My Pi](https://github.com/can1357/oh-my-pi) plugin. It is the `glockyco` marketplace and publishes one plugin, `personal@glockyco`, which every host installs and upgrades with OMP's plugin manager. Hosts own OMP, language servers, Plannotator, and their own OMP state.

## Setup

Use host-owned Git, Bun 1.3.13 (`.bun-version`), Node 24 and Python 3.13. Native Windows uses Git for Windows and does not require Nix or WSL:

```sh
bun run check:toolchain
bun install --frozen-lockfile
bun x --no-install lefthook install
python3.13 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: -r requirements-dev.txt
```

In PowerShell, select the host's Python 3.13 as `python`, then use `python -m venv .venv` and `& .\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements-dev.txt` for the last two commands; no separate `py` launcher is required. Check `$LASTEXITCODE` after native commands. `PYTHON_BIN` can select an explicit interpreter; otherwise launchers use the platform's `.venv` interpreter. Windows-only pywinpty 3.0.5 is development ConPTY tooling. Nothing installs global tools or changes user PATH; .NET SDK and actual language servers are host prerequisites only for relevant runtime capabilities.

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
- `docs/plans/archive/`: historical records from the retired mutable deployment system.

## Planning

Use OpenSpec for permanent behavior changes. Read `openspec/specs/` before changing a capability. Create one change for a new contract, validate it with `openspec validate <change> --strict`, and archive it after all checks pass.

Do not restore `omp-plans`, a global planning hook, or repository-level instructions that call one.

This repository owns the generated OpenSpec workflow for every repository on the workstation. Regenerate with `bun run sync:openspec-adapters`, review and commit the generated diff; `bun run check:openspec-adapters` checks exact bytes and missing/extra adapters without changing the checkout. Both use a disposable root, this repository's config and `openspec init --tools oh-my-pi`. Do not hand-edit/format adapters, run `openspec init` in consuming repositories, or track adapters there. Consumers keep their own `openspec/` artifacts.

The portable artifact-validation definition is `.github/workflows/openspec.yml`. Consumers call it at the job level as `glockyco/omp-agent-setup/.github/workflows/openspec.yml@<reviewed full release SHA>`, optionally with repository-relative `openspec-root` (default `.`). They do not select a CLI version, copy its CI implementation, add a consumer CLI dependency or check this repository's adapters. README contains the exact YAML and offline POSIX/PowerShell host-local hook commands, including version parity, archive guard, telemetry disablement and exit propagation. Local hooks may contain that documented host-owned CLI sequence, not a private validator or downloader.

The retained `lib.openspecCheck` remains usable through existing locks:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

Adoption owners are nix-config's Windows-native/WSL-retirement integration owner and the respective phd-thesis and test-generalization maintainers. Each must record the reviewed full workflow SHA, migration evidence and removal of external adapter-freshness wiring. Flake/input removal and central-target deregistration require all three completed migrations in a later change; do not delete the interface here.

`retire-legacy-planning-archive` independently owns disposition/deletion of the 17 historical records. Native setup changes do not broaden that scope. Preserve the writing skill's support assets, upstream MIT license and `add-research-paper-writing-skill` rights record; its archival ownership remains independent.

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

Run the complete native gate before release:

```sh
bun run ci
```

It retains formatting, types, dead code, production audit, release tree/version, coverage, extension behavior, real Git hooks and deterministic retrieval checks, and adds the Bun/mirror and OpenSpec generator/workflow parity checks, adapter freshness, strict active/archive artifact validation and installed-release gate. Native CI runs equivalent gates on `ubuntu-latest`, `macos-15`, `windows-latest`, plus the shared OpenSpec context. Required contexts must cover all actors, including administrators and automation; keep force-push/deletion disabled.

Pre-push `check:local` selects deterministic `*.unit.test.ts` through `check:test:unit`. Real OpenSpec/commitlint/lefthook/Git commands, compiled launchers, annotation process lifecycle and CLI entrypoints are `*.integration.test.ts`, with 30 s case budgets, and run in CI rather than pre-push. `check:test` runs both sets together with the unchanged per-file 80% coverage floor; the installed-cache runtime selector retains both runtime suites and explicit coverage. Do not reclassify or skip real-process scenarios merely to make a loaded workstation's hook timing deterministic.

The Python installed-release gate uses an absolute OMP v18.8.7 downloaded from its fixed host-asset URL and verified against the reviewed six-platform `.omp-version` JSON pin before execution, without runtime metadata/API, authentication token, installer or user PATH/registry changes. Every HOME/USERPROFILE/APPDATA/LOCALAPPDATA/temp/XDG root is isolated. Partial setup removes its own state; final CI cleanup runs after successful setup even if later gates fail. It tests real marketplace install, fresh commands/skills/rules/tools, terminal-observed LSP selection, installed-cache Bun/Python behavior, damaged candidates, upgrades, disabled/settings state and forward rollback. CI's official binary never replaces Korolev's Tern-managed OMP; fixtures prove selection/behavior, not real LSP protocol or browser acceptance.

Resolve owned scratch roots through filesystem realpath before deriving fake HOME and state paths; keep candidate work/release directories beneath that home. Preserve empty pre-install and exactly-once owned-manager assertions even for Windows short names or symlink/junction roots. Do not fix leaked or duplicate discovery with an output filter, extra config marker or host override.

`nix flake check` remains an independent compatibility check for retained flake consumers, not a prerequisite for native development or publication. Keep `lib.openspecCheck` operational.

Install hooks explicitly with `bun x --no-install lefthook install` after frozen installation. Use Bun's built-in `x` subcommand, not an optional `bunx` executable alias. Hooks run installed native tools without Nix or downloads: staged formatting/types on commit, authoritative commitlint on the message, and frozen install plus `bun run check:local` on push. The fast local gate covers toolchain, lint, types, dead code, release version, unit tests, adapter freshness and strict OpenSpec validation; it omits network audit and installed-release download/terminal checks. Every PR's three-host CI runs the complete `bun run ci`, including both omitted checks. The Bun hook runner strips `git rev-parse --local-env-vars` names only from its child environment, never the parent.

A permanent behavior change needs an observable test that fails for a plausible regression. Do not test source text when the behavior can be executed.

## Dependency updates

Renovate owns JS dependencies, lockfiles, actions, Bun/mirror, npm OpenSpec/workflow, Python setup and Windows terminal-support pins. `.bun-version` is the sole runtime selection; `constraints.bun` is a checked lockfile-writing mirror. A Bun bump must update both and regenerate `bun.lock` with selected Bun. OpenSpec generator and reusable-workflow pins move together, and generator-only adapter differences require review. OMP tag-only automation is disabled: the maintainer owns its tag/six-digest record through `bun run sync:release-omp -- vX.Y.Z`, which fetches only the explicit official release's SHA256SUMS.txt and changes the complete pin after validation. Review all platform digests and run cross-system gates; never select latest or add runtime metadata/token access. Updates remain review-only and do not merge, publish or upgrade a host.

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

1. Raise the version in `.omp-plugin/marketplace.json`, `plugin/package.json`, and the root `package.json` in the same commit as any runtime change.
2. Run the full native gate and obtain Linux/macOS/Windows and shared OpenSpec CI contexts, plus actual fresh Tern-managed Korolev/macbook-pro browser acceptance for changed visual behavior.
3. With explicit owner authorization, merge the reviewed release and create the immutable tag `vX.Y.Z`.
4. Install the published release into a disposable OMP profile and confirm its version and capabilities.
5. Upgrade hosts with `omp plugin marketplace update glockyco` and `omp plugin upgrade --scope user personal@glockyco`, then verify the changed capability in a fresh OMP session in Tern.

Roll back by publishing known-good content as a newer version. The plugin and OMP versions are independent: `omp update` never upgrades the plugin, and a plugin release never updates OMP.

## Commits

Use Conventional Commits with a useful body. The body explains why the change exists and the constraint or tradeoff that selected the implementation. Keep code, tests, and related specification changes in the same logical commit. Never push without an explicit user request.
