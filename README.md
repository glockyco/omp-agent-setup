# Personal OMP Plugin

Immutable personal behavior for [Oh My Pi](https://github.com/can1357/oh-my-pi). The flake exports one valid OMP plugin directory for Darwin and Linux.

This repository does not install OMP or write to `~/.omp/agent`. The separate `nix-darwin` workstation repository pins this flake, adds the plugin to the default OMP wrapper, and owns language-server packages and activation.

[![CI](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml/badge.svg)](https://github.com/glockyco/omp-agent-setup/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Plugin contents

| Path | Capability |
|---|---|
| `plugin/extensions/personal-commit.ts` | Structured commit, amend, and non-mutating preview tool |
| `plugin/extensions/plannotator.ts` | Local browser annotation of document and assistant-response snapshots |
| `plugin/skills/commit-policy/` | Atomic checkpoint, Conventional Commit, and causal body guidance |
| `plugin/skills/research-evidence/` | Computer-science search, paper acquisition, evidence reading, metadata, and BibTeX workflow |
| `plugin/skills/simplified-technical-english/` | Audited ASD-STE100 Issue 9 relationships and software-writing adaptations |
| `plugin/rules/personal-policy.md` | Short personal routing and checkpoint deviations from OMP defaults |
| `plugin/lsp/lsp.json` | Markdown Oxide selection, Marksman disablement, and the Roslyn and Svelte overrides, in a scoped plugin root |
| `plugin/commands/`, `plugin/skills/openspec-*/` | The generated OpenSpec workflow, loaded by every repository |

The plugin contains no credentials, providers, models, agents, service configuration, or mutable caches.

## Fleet outputs

Beside the plugin, this flake exposes the check that every repository holding OpenSpec artifacts runs. It is not part of the payload.

| Output | Purpose |
|---|---|
| `lib.openspecCheck { pkgs, src }` | Validates a repository's OpenSpec artifacts strictly and rejects a change archived with unfinished tasks |

A consuming repository adds the input and references the output, and says nothing about which commands run or which CLI version validates:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

## Use from Nix

Build the immutable directory:

```bash
nix build .#
```

A host wrapper must load the scoped LSP root and all declared extensions:

```bash
plugin="$(nix build .# --no-link --print-out-paths)"
omp --plugin-dir "$plugin/lsp" --extension "$plugin"
```

The workstation wrapper supplies fixed store paths instead of evaluating the source checkout at runtime.

## Visual annotation

The workstation wrapper supplies Plannotator separately. Use a local interactive OMP session on macOS or Linux/WSL:

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

Reviews use random loopback ports and the platform-native browser, including the Windows browser on WSL. SSH and noninteractive invocation are unsupported. The child disables sharing and ignores inherited browser, port, and operational Plannotator overrides. It preserves `PLANNOTATOR_DATA_DIR`.

The adapter supports the stock `plannotator annotate <snapshot.md> --json` CLI, without `--gate` or a downstream client-lease patch. The workstation supplies an on-demand, commit-pinned vendor package. Automatic browser-tab-close dismissal is not guaranteed. The parent workstation change retains stock-package, browser, and native-platform release checks.

This adapter adds no planner, approval gate, automatic edits, code-review or PR commands, installer, updater, publisher, or full Pi extension.

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

CI runs the flake checks on Apple Silicon macOS and x86-64 Linux. The checks inspect package shape, load the extension in isolation, execute real Git hooks, verify paper-fetch fixtures, validate generated OpenSpec adapters and archived task completeness, and validate the 53-rule STE inventory.

Renovate owns JavaScript dependencies and GitHub Actions. A separate weekly workflow owns Nix flake inputs. Both create review-only pull requests; required Darwin and Linux checks must pass before merge. See the workstation [dependency-update runbook](https://github.com/glockyco/nix-config/blob/main/docs/operations/dependency-updates.md) for the cross-repository release and rollback procedure.

## Release flow

1. Change the plugin and its observable tests together.
2. Run `nix develop --command bun run ci` and `nix flake check`.
3. Publish one reviewed repository revision.
4. Update the `personal-omp-plugin` lock in `nix-darwin`.
5. Build and activate the workstation generation.
6. Run a real wrapped OMP session before removing or changing an older generation.

OMP continues to own authentication, preferences, sessions, history, caches, logs, and databases under its writable state directory. Herdr continues to own its generated OMP integration.

## ASD-STE100 boundary

The repository records the official Issue 9 PDF source and SHA-256, and all 53 working paraphrases were audited against that copy. The PDF and complete controlled dictionary are not committed.

The skill provides unofficial STE-based guidance. It does not make AI output compliant. A qualified writer must use the official standard and dictionary for a compliance decision.

## License

[MIT](./LICENSE) covers this repository's code and original text only. Third-party standards and source material retain their own rights.
