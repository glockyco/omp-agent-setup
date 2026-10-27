# Personal OMP Plugin

Personal OMP Plugin adds commit guidance, research and paper-writing skills, browser annotation, and OpenSpec workflows to [Oh My Pi](https://github.com/can1357/oh-my-pi). It is a personal configuration, including workflows for the `notes` vault, rather than a general-purpose OMP setup.

The repository publishes the `personal` plugin through the `glockyco` marketplace. It does not install OMP or the external tools its capabilities use.

## Install

Install OMP on macOS, Linux, WSL, or Windows, then run:

```sh
omp plugin marketplace add glockyco/omp-agent-setup
omp plugin install --scope user personal@glockyco
omp plugin list
```

Start a new OMP session to load the plugin. Use the plugin manager as the only installation path, so OMP does not discover duplicate copies. Do not also pass `--extension` or `--plugin-dir`, or copy the plugin's rules, skills, or commands into your configuration.

Install the external tools for the capabilities you use. Browser annotation needs `plannotator` on PATH. The research helper needs Python 3. Language-server overrides in [plugin/lsp/lsp.json](plugin/lsp/lsp.json) need the corresponding server executables on PATH and matching project markers.

## Upgrade

Refresh the catalog before upgrading, then check the installed version:

```sh
omp plugin marketplace update glockyco
omp plugin upgrade --scope user personal@glockyco
omp plugin list
```

Start a new session afterwards. `/reload-plugins` does not load new extension modules. `omp update` updates OMP itself, not this plugin.

## Use the skills and workflows

Ask OMP to create a commit, investigate research evidence, draft a paper section, check material with persona trials, work with the `notes` vault, or prepare its weekly review. The [skills](plugin/skills) describe when each workflow applies and its prerequisites. The [rules](plugin/rules) apply across sessions and cover commits, prose, documentation, and project handoffs.

The plugin exposes OpenSpec commands with the `/personal:` prefix:

```text
/personal:opsx-propose
/personal:opsx-explore
/personal:opsx-apply
/personal:opsx-update
/personal:opsx-sync
/personal:opsx-archive
```

Follow each command's prompts in the repository you want to change. The [generated command definitions](plugin/commands) describe their inputs. Generated instructions may use `/opsx-*` as shorthand, but the installed commands need the prefix.

## Annotate a document or response

Use a local interactive OMP TUI session with `plannotator` available. For example, from this checkout:

```text
/plannotator-annotate README.md
/plannotator-last
/plannotator-cancel
```

`/plannotator-annotate` opens a snapshot of a UTF-8 text or Markdown file. Relative paths use the session's working directory. Quote paths containing spaces. Absolute filesystem paths and session-local `local://` documents also work. `/plannotator-last` opens the latest completed visible assistant response on the active branch.

Submit annotations in the browser to return feedback to the conversation. The plugin does not edit the source or treat feedback as approval. A warning identifies feedback whose source has changed since the snapshot.

Only one review can run per session. Use `/plannotator-cancel` if a closed tab leaves a review pending. Remote, SSH, and noninteractive sessions are not supported because the review needs a local browser and UI.

## What it changes

OMP manages the installed plugin cache and registry, authentication, sessions, and settings. The plugin payload does not write to `~/.omp` or install or update host tools. It contains no credentials, provider or model configuration, sessions, or mutable caches.

Skills can direct work on repository files and vault notes. The `personal_commit` tool creates or amends local Git commits after files have been staged, or previews the commit without changing the repository. It does not stage or push.

Annotation creates a temporary snapshot and runs Plannotator on a loopback port with sharing disabled. It returns annotations to the OMP conversation and removes its temporary snapshot when the review finishes or is cancelled. Plannotator preferences and history are left intact.

## Validate OpenSpec in another repository

This repository also publishes a reusable [OpenSpec validation workflow](.github/workflows/openspec.yml). It checks active and archived artifacts without requiring the plugin or the calling repository's dependencies.

Call it at job level, replacing the placeholder with a reviewed full release commit SHA:

```yaml
jobs:
  openspec:
    uses: glockyco/omp-agent-setup/.github/workflows/openspec.yml@<reviewed full release SHA>
```

If `openspec/` is not at the repository root, pass `openspec-root` under `with` as the repository-relative directory that contains it. Keep the reference immutable so updates can be reviewed. The shared workflow owns the validation flags and uses a generated CLI pin from this repository's [development dependency](package.json). It cannot read that manifest from a caller's checkout. Do not copy its implementation or the plugin's generated adapters into the calling repository.

Local hooks can run the same validation offline with a host-provisioned OpenSpec CLI. The expected versions below are generated from the same dependency. The commands stop when the CLI does not match or lacks `validate --archived`. Correct a mismatch through host provisioning, not with a download in the hook.

POSIX:

```sh
set -eu
version="$(openspec --version)"
test "$version" = "1.14.3" || { echo "Expected OpenSpec 1.14.3, observed $version. Ask the host tool owner to correct it." >&2; exit 1; }
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
if ($version.Trim() -ne '1.14.3') { Write-Error "Expected OpenSpec 1.14.3, observed $version. Ask the host tool owner to correct it."; exit 1 }
$help = & openspec validate --help
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
if (-not ($help -match '--archived')) { Write-Error 'OpenSpec lacks validate --archived.'; exit 1 }
$env:CI = '1'; $env:OPENSPEC_TELEMETRY = '0'
& openspec validate --all --strict --no-interactive
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& openspec validate --archived --strict --no-interactive
exit $LASTEXITCODE
```

Existing Nix consumers can use `lib.openspecCheck` from [flake.nix](flake.nix).

## Change the plugin

[AGENTS.md](AGENTS.md) covers the development environment, checks, generated adapters, dependency updates, and release procedures. Use its setup instructions before running the complete native gate:

```sh
bun run ci
```

[package.json](package.json) defines the individual checks. [openspec/specs](openspec/specs) holds the behavior contracts. Documentation-only changes do not need a version bump. Runtime changes follow the release procedure in AGENTS.md.

Select the OpenSpec CLI only through the exact development dependency in [package.json](package.json). Renovate leaves it alone, because a change to the manifest alone cannot pass. After updating it, install the updated dependencies and run `bun run sync:openspec-adapters` to refresh the reusable workflow, both offline-hook snippets above, and the generated adapters together. Refresh the independent [Nix npm lock](nix/openspec/package-lock.json) and its fixed hashes for the same selection. The native toolchain and adapter checks reject stale generated mirrors, and the native toolchain check also rejects a Nix lock with a different root version.

## License

[MIT](LICENSE) covers this repository's code and original text. The writing skill includes [Master-cai's upstream MIT license](plugin/skills/research-paper-writing/LICENSE).
