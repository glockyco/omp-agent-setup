## 1. Establish the baseline

- [x] 1.1 Record the nine roots that currently track adapters and the file count in each: the eight repositories under `~/src/github.com/glockyco` (`HotRepl`, `ancient-kingdoms-mods`, `ardenfall-compendium`, `erenshor-data-mining`, `omp-agent-setup`, `phd-thesis`, `renovate-config`, `test-generalization`) and `~/.config/nix-darwin`, each holding 6 commands and 6 skills.
- [x] 1.2 Record the repository-specific capabilities that must survive: `live-extraction` in `ardenfall-compendium`, `commit-guidelines` and `writing-chapter-prose` in `phd-thesis`, the two local skills in `test-generalization`, and every `.omp/rules/` file.
- [x] 1.3 Record the three current adapter content hashes and which roots hold each, so the end state can be shown to collapse to one.

## 2. Produce the payload

- [x] 2.1 Add a script that generates the adapters into a scratch project root with `CI=1` and `OPENSPEC_TELEMETRY=0`, then copies `commands/` and `skills/openspec-*/` into `plugin/`. It must not write anywhere else in the working tree.
- [x] 2.2 Run it and commit `plugin/commands/` and `plugin/skills/openspec-*/`.
- [x] 2.3 Confirm the payload matches this repository's existing `.omp/` adapters byte for byte, proving the copy step introduces no change of its own.

## 3. Keep the generator the only writer

- [x] 3.1 Exclude the generated payload from biome in `biome.json`, with a comment naming the reason: the reproduce-and-diff check is meaningless if a formatter also writes those files.
- [x] 3.2 Confirm the exclusion holds by staging a payload file and running the pre-commit formatter job, then checking the file is unchanged.

## 4. Verify the payload

- [x] 4.1 Repoint the `openspec-adapters` flake check at `plugin/commands` and `plugin/skills` instead of `.omp/commands` and `.omp/skills`.
- [x] 4.2 Extend the check so a command or skill present in the generation but missing from the payload fails, not only a content difference.
- [x] 4.3 Add `test -d` and per-file assertions for the generated adapters to the `package-shape` check.
- [x] 4.4 Prove both checks fail on drift: edit one payload file, run `nix flake check`, confirm failure naming the file, restore it, confirm success.
- [x] 4.5 Confirm the checks leave the working tree unchanged.

## 5. Prove availability before removing anything

- [x] 5.1 Build the plugin and start OMP against the built store path under a disposable profile, in a directory that tracks no adapters.
- [x] 5.2 Confirm the six OpenSpec skills are discoverable and that `skill://openspec-propose` resolves.
- [x] 5.3 Confirm each of the six commands is invocable, and record whether it resolves as `opsx-propose` or under a plugin-qualified name. This decides the rollout.
- [x] 5.4 If the commands resolve only under a qualified name, stop and report before any deletion. The options are accepting the qualified name or centralising the skills only. Both change the plan.
- [x] 5.5 Confirm a repository-level command of the same name still overrides the payload's.

## 6. Scope the loader roots

- [x] 6.1 Move `plugin/lsp.json` to `plugin/lsp/lsp.json`, so the LSP overrides can be loaded from a root that carries no commands.
- [x] 6.2 Update the `package-shape` check to assert the new location.
- [x] 6.3 Update the plugin's own documentation of its source layout.
- [x] 6.4 In `~/.config/nix-darwin/packages/personal-omp.nix`, load the package root with `--extension` and the `lsp/` subdirectory with `--plugin-dir`.
- [x] 6.5 Update `verify-personal-omp` for the new layout and flags.
- [x] 6.6 Confirm against the built payload that each workflow command appears once, that no command carries a store-derived name, and that an overridden language server still resolves.

## 7. Propagate to the workstation

- [x] 7.1 In `~/.config/nix-darwin`, advance the `personal-omp-plugin` input and rebuild.
- [x] 7.2 Run `verify-personal-omp` and confirm it passes.
- [x] 7.3 Confirm in an ordinary session, started through the personal wrapper in a repository that still tracks its own copies, that the workflow is available and the repository copies are the ones taking effect.

## 8. Remove the copies

- [x] 8.1 Remove `.omp/commands/opsx-*.md` and `.omp/skills/openspec-*/` from `~/.config/nix-darwin`, and repoint or delete its `openspec-adapters` check, which now guards files that no longer exist.
- [x] 8.2 Remove them from `omp-agent-setup`, whose sessions are now served by the payload it ships.
- [x] 8.3 Remove them from `HotRepl`, and confirm the `dprint` reformatting that made its copies divergent is no longer reachable.
- [x] 8.4 Remove them from `ardenfall-compendium`, keeping `live-extraction`.
- [x] 8.5 Remove them from `phd-thesis`, keeping `commit-guidelines`, `writing-chapter-prose`, and `.omp/rules/`.
- [x] 8.6 Remove them from `erenshor-data-mining`, `renovate-config`, and `test-generalization`, keeping the local skills in the last.
- [x] 8.7 Remove them from `ancient-kingdoms-mods`, together with the per-repository apparatus that guarded them: `scripts/check-openspec-adapters.sh`, the `@fission-ai/openspec` devDependency and its lockfile entry, the `check:openspec` script, the knip exemption, the `lefthook.yml` job, and the `ci.yml` job. Restore the `.gitignore` rule to whichever form is correct once nothing generated is tracked there.
- [x] 8.8 Commit each repository separately, so restoring one is a single revert.
- [x] 8.9 Confirm in each repository that a session still offers the workflow and that the repository's own skills and rules are unaffected.

## 9. Record the decision

- [x] 9.1 Record in `~/.config/nix-darwin/docs/architecture/personal-omp-environment.md` that the generated workflow adapters are machine-level and ship in the plugin, that consuming repositories track none, and that a repository may override by name.
- [x] 9.2 State in this repository's `AGENTS.md` and `README.md` that `openspec init` is not run in consuming repositories and that the payload is regenerated here.
- [x] 9.3 Note in `ancient-kingdoms-mods` that `setup-openspec-workflow` is superseded in part: its adapter tracking and per-repository check are reverted here, and its remaining discoverability task belongs to that repository's `AGENTS.md` migration. Leave the rescope to that repository.

## 10. Close out

- [x] 10.1 Run `nix flake check` in this repository and confirm every check passes.
- [x] 10.2 Run `openspec validate --all --strict` in this repository.
- [x] 10.3 Confirm the end state: one tracked copy of each adapter, one content hash, and no repository holding a generated command or skill.
