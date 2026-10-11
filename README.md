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
| `plugin/rules/plain-prose.md` | Plain punctuation in the prose agents write, always applied. Code, grammars, quotations and manuscripts are exempt |
| `plugin/lsp/lsp.json` | Markdown Oxide selection, Marksman disablement, and the Roslyn and Svelte overrides, delivered by the catalog's `lspServers` field |
| `plugin/commands/`, `plugin/skills/openspec-*/` | The generated OpenSpec workflow, loaded by every repository |

The plugin contains no credentials, providers, models, agents, service configuration, or mutable caches.

The marketplace exposes the OpenSpec workflow commands under the plugin's namespace: `/personal:opsx-apply`, `/personal:opsx-archive`, `/personal:opsx-explore`, `/personal:opsx-propose`, `/personal:opsx-sync`, and `/personal:opsx-update`. The generated adapter text may still say `/opsx-*`; that is the generator's shorthand, and the installed entry points carry the prefix. Skill names (`openspec-*`) and the extension-registered `/plannotator-*` commands are unprefixed.

## Host prerequisites

The plugin selects language servers but does not install them. OMP starts a server only when its executable resolves and its project markers match, so a host without, for example, `Microsoft.CodeAnalysis.LanguageServer` simply never starts Roslyn. The research helper needs a Python 3 on the host when an agent runs it explicitly. Visual annotation needs the `plannotator` command.

## Visual annotation

Use a local interactive OMP TUI session with UI on native Windows, macOS, or Linux/WSL:

```text
/plannotator-annotate docs/design.md
/plannotator-annotate "docs/design notes.md"
/plannotator-annotate "C:\Documents\design notes.md"
/plannotator-annotate "\\server\share\design notes.md"
/plannotator-annotate local://draft.md
/plannotator-last
/plannotator-cancel
```

Relative paths use the session's working directory. Drive-qualified and UNC paths are filesystem paths, not URLs. `local://` uses that session's native OMP mapping. Document inputs must be UTF-8 text or Markdown files; URLs, HTML, binary files, directories and unavailable documents fail without substitution.

`/plannotator-last` selects the latest completed visible assistant response on the active branch. It excludes thinking, tool data, and hidden messages. Both commands open a private snapshot, not an editable source file.

Submitted annotations return once as follow-up user feedback, with the source identity and snapshot hash. A changed or unavailable source produces a warning. Feedback waits while OMP is busy and starts a conversation turn when OMP is idle. The adapter does not apply replacement suggestions or treat feedback as approval.

One review can run per session. Separate sessions have independent reviews. The command interface remains available while the footer shows a pending review. Use `/plannotator-cancel` if the browser does not open or a closed tab leaves the review pending. Navigation and shutdown also cancel the review. Cancellation removes only the owned subprocess tree and temporary snapshot, not Plannotator preferences or history. Unix uses TERM/KILL on the owned process group. Windows uses creation-qualified CIM identities and built-in `taskkill /T`, then `/T /F` for survivors after a one-second grace, including recorded descendants whose original root exited. Query/termination failures are reported; they are not evidence of successful cleanup.

Reviews use random loopback ports and the platform-native browser. SSH (`SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY`), explicit remote invocation and noninteractive/no-UI sessions are refused before preparing a snapshot or listener. The child disables sharing and ignores inherited browser, port, and operational Plannotator overrides. It preserves `PLANNOTATOR_DATA_DIR`. The host supplies the native vendor executable on PATH; a missing command reports that prerequisite and never installs a wrapper or fallback. Real Korolev/macbook-pro browser acceptance is a separate release gate, not implied by process fixtures.

The adapter supports the stock `plannotator annotate <snapshot.md> --json` CLI, without `--gate` or a downstream client-lease patch. Automatic browser-tab-close dismissal is not guaranteed.

This adapter adds no planner, approval gate, automatic edits, code-review or PR commands, installer, updater, publisher, or full Pi extension.

## Fleet verification

The reusable artifact gate is separate from the plugin. Consumers use a job-level call, replacing the placeholder with the reviewed **full release commit SHA**, not mutable `main`:

```yaml
jobs:
  openspec:
    uses: glockyco/omp-agent-setup/.github/workflows/openspec.yml@<reviewed full release SHA>
    with:
      openspec-root: . # optional; a repository-relative directory containing openspec/
```

The workflow checks the caller's triggering checkout on Ubuntu with read-only contents permission. It installs its centrally pinned npm OpenSpec **1.14.0** in scratch, requires archive support, and strictly checks active and archived artifacts. It needs no caller dependencies, secrets, Bun or Nix. Absolute, escaping and missing roots fail. Consumers do not copy the CI implementation, select CLI versions or run this repository's adapter-freshness check. Workflow-reference updates are review-only GitHub Actions dependency PRs using a full immutable SHA with a reviewed release-tag annotation; the actual release SHA is supplied at publication.

Local hooks may contain this host-owned CLI sequence. Fetch the matching CLI once through host provisioning; these commands then run offline. Version mismatch is corrected by the host tool owner, never hidden by hook downloads.

POSIX:

```sh
set -eu
version="$(openspec --version)"
test "$version" = "1.14.0" || { echo "Expected OpenSpec 1.14.0, observed $version; ask the host tool owner to correct it." >&2; exit 1; }
help="$(openspec validate --help)"
printf '%s\n' "$help" | grep -q -- --archived || { echo "OpenSpec lacks validate --archived." >&2; exit 1; }
export CI=1 OPENSPEC_TELEMETRY=0
openspec validate --all --strict --no-interactive
openspec validate --archived --strict --no-interactive
```

PowerShell:

```powershell
$version = & openspec --version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if ($version.Trim() -ne '1.14.0') { Write-Error "Expected OpenSpec 1.14.0, observed $version; ask the host tool owner to correct it."; exit 1 }
$help = & openspec validate --help
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not ($help -match '--archived')) { Write-Error 'OpenSpec lacks validate --archived.'; exit 1 }
$env:CI = '1'; $env:OPENSPEC_TELEMETRY = '0'
& openspec validate --all --strict --no-interactive
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& openspec validate --archived --strict --no-interactive
exit $LASTEXITCODE
```

The retained `lib.openspecCheck { pkgs, src }` remains available with its existing pinned inputs and artifact-only Nix caching:

```nix
inputs.fleet.url = "github:glockyco/omp-agent-setup";
checks.openspec = fleet.lib.openspecCheck { inherit pkgs; src = ./.; };
```

Adoption ownership: the nix-config owner integrates the released workflow through its Windows-native/WSL-retirement changes; the phd-thesis and test-generalization repository owners review their own workflow-reference migrations. Each removes its external adapter-freshness wiring when adopting. Dates and evidence belong to those owners. Flake/input deletion and central Nix-target deregistration are a **later change**, gated on completed migrations of all three repositories; nothing here removes the interface for an unmigrated consumer.

## Development

Install host-owned Git (Git for Windows on Windows), Bun **1.3.13** from `.bun-version`, Node **24**, and Python **3.13**. Nix and WSL are not prerequisites. Development dependencies are repository-only:

```sh
bun run check:toolchain
bun install --frozen-lockfile
bunx --no-install lefthook install
python3.13 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: -r requirements-dev.txt
```

PowerShell uses the same Bun commands, then:

```powershell
py -3.13 -m venv .venv
& .\.venv\Scripts\python.exe -m pip install --only-binary=:all: -r requirements-dev.txt
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
```

The Windows-only pywinpty **3.0.5** wheel supplies ConPTY for development tests, never for plugin loading. `PYTHON_BIN` may select an explicit interpreter instead of the platform's `.venv` default.

Run the complete native gate:

```sh
bun run ci
```

It retains formatting, types, dead-code, production advisories, release tree/version, coverage, extension behavior, real Git hooks and deterministic retrieval fixtures, plus Bun/mirror and OpenSpec pin parity, adapter freshness, strict active/archive validation and installed-release verification. The installed-release launcher downloads the exact `.omp-version` **v18.8.7** platform asset into scratch, verifies its published SHA-256 before execution, and uses an absolute executable; it runs no installer and never changes user PATH/registry or Korolev's Tern OMP. The Python gate isolates every home/app-data/temp root, installs the candidate with the real manager, observes fresh capabilities and terminal-started LSP probes, exercises the installed-cache Bun/Python suite and damaged-candidate/upgrade/disabled/settings/forward-rollback controls, then removes scratch profiles. `OMP_BIN` can explicitly select the absolute pinned binary; do not point it at a mutable host/Tern installation.

Native CI runs equivalent gates on `ubuntu-latest`, `macos-15` and `windows-latest`, plus the shared OpenSpec context. ConPTY, executable probes and injected process tests do **not** establish actual language-server protocol or native-browser acceptance. The compatibility flake remains independently checkable with `nix flake check` but is not required to develop or publish.

Only the generator writes workflow payload adapters:

```sh
bun run sync:openspec-adapters
bun run check:openspec-adapters
```

Both use a disposable root with the repository config and `openspec init --tools oh-my-pi`; the checker compares all bytes and missing/extra commands/skills without changing the working tree. Never hand-edit or format these generated paths; Biome exclusions remain authoritative. Never copy adapters into consumers.

Hooks use installed native tools without downloads: staged formatting and types on commit, authoritative commitlint on the message, frozen installation and full CI on push. The Bun hook runner strips Git-local environment variables only in its child environment.

Renovate owns JS/lockfiles/actions and native Bun/constraint-mirror, OMP release tag, OpenSpec generator/workflow, Python setup and Windows terminal pins. Bun bumps regenerate the lockfile with the selected Bun; generator/workflow OpenSpec pins update together and generated differences require review. The central `glockyco/dependency-automation` control plane owns retained Nix inputs; Renovate's Nix manager stays disabled. Neither updater merges, publishes or upgrades a host.

## Release flow

1. Change the plugin and its observable tests together.
2. When the change touches anything under `plugin/` or the catalog's delivery fields, raise the version in `.omp-plugin/marketplace.json` and `plugin/package.json` together (and the root `package.json` to match). `bun run check:release` rejects a runtime change that keeps or lowers the version. Documentation-only changes need no bump.
3. Run `bun run ci` and obtain the three native matrix contexts plus shared OpenSpec context. Require actual browser acceptance in fresh Tern-managed Korolev and macbook-pro sessions separately.
4. With the owner's explicit authorization, merge the reviewed release and tag it `vX.Y.Z`. Never move a published tag.
5. Re-install the published release into a disposable OMP profile and confirm its version and capabilities before any host upgrades.
6. Upgrade each host with the commands above and verify the changed capability in a fresh OMP session.

To roll back a bad release, publish the known-good content as a newer version and upgrade to it. Do not rewrite a published tag or rely on an old cache entry surviving an upgrade.

## License

[MIT](./LICENSE) covers this repository's code and original text. The writing skill includes [Master-cai's upstream MIT license](./plugin/skills/research-paper-writing/LICENSE).
