# AGENTS.md

Source repository for the immutable personal [Oh My Pi](https://github.com/can1357/oh-my-pi) plugin. The separate `nix-darwin` repository owns the executable wrapper, plugin pin, language servers, Home Manager activation, and rollback.

## Setup

Use the pinned shell:

```bash
nix develop
bun install --frozen-lockfile
```

Do not require a globally installed Bun, npm, Python, .NET SDK, or language server.

## Source layout

- `plugin/`: the complete runtime payload copied into the Nix store.
- `plugin/package.json`: the OMP extension manifest.
- `plugin/extensions/`: dependency-free runtime extension source.
- `plugin/skills/` and `plugin/rules/`: personal behavior loaded by OMP.
- `plugin/lsp.json`: minimal differences from the pinned OMP defaults.
- `plugin/tests/`: isolated Bun and Python behavior tests.
- `types/omp.d.ts`: narrow development-only declarations for the OMP extension API.
- `openspec/specs/`: accepted behavior contracts.
- `openspec/changes/`: active and archived OpenSpec changes.
- `docs/plans/archive/`: historical records from the retired mutable deployment system.

## Planning

Use OpenSpec for permanent behavior changes. Read `openspec/specs/` before changing a capability. Create one change for a new contract, validate it with `openspec validate <change> --strict`, and archive it after all checks pass.

Do not restore `omp-plans`, a global planning hook, or repository-level instructions that call one.

## Runtime boundaries

The flake output must be a self-contained OMP plugin directory. It must not:

- write to `~/.omp/agent`;
- install or update OMP, Herdr, language servers, providers, models, or services;
- include credentials, sessions, history, caches, logs, or databases;
- depend on a mutable checkout, sibling repository, Homebrew package, or global package manager;
- copy Herdr's generated integration;
- patch installed OMP source;
- expose compatibility aliases for the retired bootstrap, `omp-skill`, or `omp-plans` paths.

The personal extension uses only runtime APIs already available in OMP's Bun process. Add a runtime dependency only when the capability cannot be implemented clearly with those APIs.

## Capability rules

### Structured commits

`personal_commit` accepts structured `commit`, `amend`, and `preview` input. Keep Git hooks enabled. Never stage, push, bypass hooks, or run planning commands from the extension. Preview must not mutate the repository.

### Research evidence

Keep source precedence deterministic. Validate downloaded PDF bytes. Require an explicit Unpaywall identity. Never fabricate a citation or infer metadata from memory when an authoritative source is available.

### Simplified Technical English

The official ASD-STE100 Issue 9 source and checksum are in `plugin/skills/simplified-technical-english/references/standard.md`. Preserve the exact 53-identifier inventory and resolved checklist citations. The guidance is STE-based; do not claim that generated output is compliant without qualified human review and the controlled dictionary.

### Language servers

OMP's built-in catalog is the base. Add an override only when a representative scenario fails without it and passes with it. The workstation wrapper, not this repository, owns executable packages. Keep one primary server per language through executable availability.

## Checks

Run both gates before release:

```bash
bun run ci
nix flake check
```

`bun run ci` covers formatting, types, dead code, dependency advisories, extension behavior, real Git hooks, deterministic retrieval fixtures, and STE traceability. `nix flake check` covers immutable package shape and isolated payload execution. CI repeats the flake checks on `aarch64-darwin` and `x86_64-linux`.

A permanent behavior change needs an observable test that fails for a plausible regression. Do not test source text when the behavior can be executed.

## Release

1. Run both local gates.
2. Publish the reviewed revision.
3. Update the `personal-omp-plugin` input in `nix-darwin`.
4. Build and activate the workstation generation.
5. Run a real wrapped session that observes the store path and exercises the changed capability.

The plugin and OMP revisions are independent. Do not update one implicitly while releasing the other.

## Commits

Use Conventional Commits with a useful body. The body explains why the change exists and the constraint or tradeoff that selected the implementation. Keep code, tests, and related specification changes in the same logical commit. Never push without an explicit user request.
