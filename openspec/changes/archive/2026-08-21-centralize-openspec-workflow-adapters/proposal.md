## Why

The OpenSpec workflow adapters — six `opsx-*` commands and six `openspec-*` skills — are generated files with identical content, committed independently into nine repositories: eight project repositories under `~/src/github.com/glockyco` plus `~/.config/nix-darwin`. That is 108 tracked files encoding six documents.

They are machine-level tooling. Nothing in them refers to any repository, and every copy is produced by the same generator from the same configuration. The test that separates repository content from machine tooling is whether deleting a file would be wrong for one repository specifically or wrong for every repository equally, and these fail it in the most direct way: their bytes are identical.

Three consequences are already visible.

- **The copies have drifted.** All nine report `generatedBy: "1.9.0"`, yet three distinct content hashes exist. `HotRepl` differs because `dprint` hard-wraps every paragraph; `ardenfall-compendium` differs because `prettier` inserts a blank line before each fenced block. Generated files committed into repositories with their own formatting regimes have two owners, and the formatter wins on every commit.
- **Verifying them costs one apparatus per repository.** `nix-darwin` and this repository each carry a regenerate-and-diff check. `ancient-kingdoms-mods` recently added a third, with a pinned npm dependency, a knip exemption, a pre-commit job, and a CI job. Nine repositories imply nine copies of a guard for nine copies of a file.
- **The version can skew per repository.** Each copy is only as current as the last time someone ran the generator there.

Meanwhile the mechanism that solves this is already in production. This repository's plugin ships three skills, one rules file, and one extension, loaded into every session through `omp --plugin-dir <plugin> --extension <plugin>`. OMP resolves plugin skills at provider priority 90 and plugin commands from invocation roots ahead of project and user roots, and a repository can still override either by name.

The plugin's accepted specification currently forbids this, and that is the decision being revisited: *"Development tools, generated planning adapters, and repository tests SHALL remain outside the default immutable plugin payload unless OMP needs them at runtime."* Once the repository copies are gone, OMP does need them at runtime, so the exception the requirement already names is the one that now applies.

## What Changes

- Ship the six OpenSpec commands and six OpenSpec skills in the plugin payload, so every session gets them from one flake-pinned source.
- Generate them into the payload rather than into this repository's own `.omp/`, and repoint the existing adapter freshness check at the payload.
- Exempt the generated payload from this repository's formatter explicitly, so the generator is the only writer of those bytes.
- Assert the adapters in the package-shape check, so an incomplete payload fails the release gate.
- Remove the tracked adapters from all nine consuming roots once the plugin that replaces them is installed, keeping every repository-specific skill and rule.
- Remove the per-repository verification apparatus that existed only to guard those copies, including the npm dependency, knip exemption, hook job, and CI job added in `ancient-kingdoms-mods`.
- Record the machine-level decision in the cross-repository architecture document that owns it.
- **BREAKING** for any checkout used without the personal OMP wrapper: the workflow arrives with the plugin, not with the repository.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the payload now includes generated planning adapters and commands; capability isolation covers a larger declared surface; adapter freshness verifies the payload instead of this repository's `.omp/`; and consuming repositories are declared to hold no copies.

## Impact

- **Plugin payload:** `plugin/commands/` (new) and `plugin/skills/openspec-*/` (new). The derivation copies `./plugin` wholesale, so no packaging change is required.
- **Checks:** the `openspec-adapters` and `package-shape` flake checks.
- **Formatting:** `biome.json` and `lefthook.yml` in this repository.
- **Consuming roots:** `.omp/commands/` and `.omp/skills/openspec-*/` removed from `HotRepl`, `ancient-kingdoms-mods`, `ardenfall-compendium`, `erenshor-data-mining`, `omp-agent-setup`, `phd-thesis`, `renovate-config`, `test-generalization`, and `~/.config/nix-darwin`.
- **Preserved:** every `openspec/` directory, every repository-specific skill (`live-extraction`, `commit-guidelines`, `writing-chapter-prose`, and the two in `test-generalization`), and every `.omp/rules/` file.
- **Propagation:** reaches a workstation only after `nix flake update personal-omp-plugin` in `~/.config/nix-darwin` and a rebuild, which is a required ordering constraint rather than an incidental one.
- **Not in scope:** migrating `CLAUDE.md` and `.claude/` to `AGENTS.md` in `ancient-kingdoms-mods`. That is a separate follow-up, tracked by that repository's own change, and it is where the remaining discoverability task of `setup-openspec-workflow` belongs.
