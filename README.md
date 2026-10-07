# Personal OMP Plugin

Personal behavior for [Oh My Pi](https://github.com/can1357/oh-my-pi), installed and upgraded through OMP's own plugin manager. The repository is the `glockyco` marketplace; it publishes one plugin, `personal`.

This repository does not install OMP, language servers, or Plannotator, and it never writes to `~/.omp`. OMP owns the installed plugin cache and registry, authentication, sessions, and settings.

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Install

On macOS, Linux, WSL, or Windows, with upstream OMP installed:

```bash
omp plugin marketplace add glockyco/omp-agent-setup
omp plugin install --scope user personal@glockyco
```

Start a new OMP session afterwards. Do not also pass `--extension` or `--plugin-dir` for this plugin, and do not copy its rule, skills, or commands into your own configuration.

## Upgrade

Refresh the catalog first, then upgrade the user-scoped plugin explicitly, then start a new OMP session:

```bash
omp plugin marketplace update glockyco
omp plugin upgrade --scope user personal@glockyco
```

The refresh is what makes a newer release visible: OMP offers an upgrade only when the catalog entry's version is newer. A targeted upgrade of an unchanged version just reinstalls it, so a startup notice or an all-plugin upgrade is not evidence that a release arrived; check `omp plugin list` instead. `/reload-plugins` does not load new extension modules. `omp update` updates OMP itself, never this plugin, and the other way round.

## Plugin contents

| Path | Capability |
|---|---|
| `plugin/extensions/personal-commit.ts` | Structured commit, amend, and non-mutating preview tool |
| `plugin/extensions/plannotator.ts` | Local browser annotation of document and assistant-response snapshots |
| `plugin/skills/commit-policy/` | Atomic checkpoint, Conventional Commit, and causal body guidance |
| `plugin/skills/research-evidence/` | Computer-science search, paper acquisition, evidence reading, metadata, and BibTeX workflow |
| `plugin/skills/research-paper-writing/` | Master-cai's outline-first paper drafting, section guides, examples, and skeptical self-review. Source verification remains with `research-evidence` |
| `plugin/rules/personal-policy.md` | Short personal routing and checkpoint deviations from OMP defaults, always applied |
| `plugin/lsp/lsp.json` | Markdown Oxide selection, Marksman disablement, and the Roslyn and Svelte overrides, delivered by the catalog's `lspServers` field |
| `plugin/commands/`, `plugin/skills/openspec-*/` | The generated OpenSpec workflow, loaded by every repository |

The plugin contains no credentials, providers, models, agents, service configuration, or mutable caches.

The marketplace exposes the OpenSpec workflow commands under the plugin's namespace: `/personal:opsx-apply`, `/personal:opsx-archive`, `/personal:opsx-explore`, `/personal:opsx-propose`, `/personal:opsx-sync`, and `/personal:opsx-update`. The generated adapter text may still say `/opsx-*`; that is the generator's shorthand, and the installed entry points carry the prefix. Skill names (`openspec-*`) and the extension-registered `/plannotator-*` commands are unprefixed.

## Host prerequisites

The plugin selects language servers but does not install them. OMP starts a server only when its executable resolves and its project markers match, so a host without, for example, `Microsoft.CodeAnalysis.LanguageServer` simply never starts Roslyn. The research helper needs a Python 3 on the host when an agent runs it explicitly. Visual annotation needs the `plannotator` command.

## Visual annotation

Use a local interactive OMP session on macOS or Linux/WSL:

```text
/plannotator-annotate docs/design.md
/plannotator-annotate "docs/design notes.md"
/plannotator-annotate local://draft.md
/plannotator-last
/plannotator-cancel
```

Relative paths use the session's working directory. `local://` uses that session's native OMP mapping. Document inputs must be UTF-8 text or Markdown files; URLs, HTML, binary files, and directories are unsupported.

`/plannotator-last` selects the latest completed visible assistant response on the active branch. It excludes thinking, tool data, and hidden messages. Both commands open a private snapshot, not an editable source file.

Submitted annotations return once as follow-up user feedback, with the source identity and snapshot hash. A changed or unavailable source produces a warning. Feedback waits while OMP is busy and starts a conversation turn when OMP is idle. The adapter does not apply replacement suggestions or treat feedback as approval.

One review can run per session. Separate sessions have independent reviews. The command interface remains available while the footer shows a pending review. Use `/plannotator-cancel` if the browser does not open or a closed tab leaves the review pending. Navigation and shutdown also cancel the review. Cancellation removes only the owned process and temporary snapshot, not Plannotator preferences or history.

Reviews use random loopback ports and the platform-native browser, including the Windows browser on WSL. SSH and noninteractive invocation are unsupported. The child disables sharing and ignores inherited browser, port, and operational Plannotator overrides. It preserves `PLANNOTATOR_DATA_DIR`. Native Windows hosting is not yet an accepted platform: its process cleanup has its own open acceptance gate.

The adapter supports the stock `plannotator annotate <snapshot.md> --json` CLI, without `--gate` or a downstream client-lease patch. Automatic browser-tab-close dismissal is not guaranteed.

This adapter adds no planner, approval gate, automatic edits, code-review or PR commands, installer, updater, publisher, or full Pi extension.

## Fleet outputs

Beside the plugin, this flake exposes the check that every repository holding OpenSpec artifacts runs. It is not part of the plugin, and installing the plugin does not need Nix.

| Output | Purpose |
|---|---|
| `lib.openspecCheck { pkgs, src }` | Validates a repository's OpenSpec artifacts strictly and rejects a change archived with unfinished tasks |

A consuming repository adds the input and references the output, and says nothing about which commands run or which CLI version validates:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

## Development

Enter the pinned shell and install JavaScript development dependencies:

```bash
nix develop --command bun install --frozen-lockfile
```

Run the release gates:

```bash
nix develop --command bun run ci
nix flake check
```

`bun run ci` covers formatting, types, dead code, dependency advisories, the release tree, the release-version signal, extension behavior, real Git hooks, and deterministic retrieval fixtures. `nix flake check` runs the release gate: it installs the candidate catalog with the locked OMP's real plugin manager into a disposable profile, observes the commands, skills, rule, tools, and language-server selection that a fresh session gets, runs the behavior tests against the installed cache, and checks negative controls and upgrades. It also validates the generated OpenSpec adapters and archived task completeness. Run the gate by hand with `OMP_BIN=$(command -v omp) python3 tests/release_gate.py`. CI runs both gates on Apple Silicon macOS and x86-64 Linux.

Renovate owns JavaScript dependencies and GitHub Actions. A separate weekly workflow owns Nix flake inputs. Both create review-only pull requests; required Darwin and Linux checks must pass before merge.

## Release flow

1. Change the plugin and its observable tests together.
2. When the change touches anything under `plugin/` or the catalog's delivery fields, raise the version in `.omp-plugin/marketplace.json` and `plugin/package.json` together (and the root `package.json` to match). `bun run check:release` rejects a runtime change that keeps or lowers the version. Documentation-only changes need no bump.
3. Run `nix develop --command bun run ci` and `nix flake check`.
4. With the owner's explicit authorization, merge the reviewed release and tag it `vX.Y.Z`. Never move a published tag.
5. Re-install the published release into a disposable OMP profile and confirm its version and capabilities before any host upgrades.
6. Upgrade each host with the commands above and verify the changed capability in a fresh OMP session.

To roll back a bad release, publish the known-good content as a newer version and upgrade to it. Do not rewrite a published tag or rely on an old cache entry surviving an upgrade.

## License

[MIT](./LICENSE) covers this repository's code and original text. The writing skill includes [Master-cai's upstream MIT license](./plugin/skills/research-paper-writing/LICENSE).
