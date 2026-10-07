# Evidence

## Candidate gates (2026-10-07, Korolev WSL, Nix 2.34.8)

Base revision `7dee4b7`, candidate version `0.2.0`, locked `llm-agents` `83984ebbbe5322b261d9fdc24eb15cf44f23abec` (OMP 18.4.12).

- `nix develop --command bun install --frozen-lockfile`: no changes.
- `nix develop --command bun run ci`: lint, types, knip, audit (no vulnerabilities), `check:release` (`5 payload file(s) changed; release 0.1.0 -> 0.2.0`), 57 tests passing.
- `nix flake check --print-build-logs` (x86_64-linux): all checks passed; `release-gate` ran 16 tests OK in the sandbox (the forward-rollback test was added afterwards and passes locally, see below).
- `openspec validate publish-plugin-through-omp-plugin-manager --strict`: valid.
- `lib.openspecCheck` against a disposable invalid fixture (a requirement without SHALL): build failed as intended; the repository's own contracts check passes.

## Observation method

`tests/release_gate.py` installs the candidate with the real plugin manager into a disposable profile and observes the shipped executable, not source loaders: `omp --mode rpc --no-ui` for `get_available_commands` and `get_state.systemPrompt`, and an interactive pseudo-terminal session with `lsp.lazy: false` for the language servers OMP actually spawns. Each profile uses a local unreachable model, so no provider request is possible.

Observed for the candidate on every run: six `personal:opsx-*` commands once each and no bare aliases; `plannotator-annotate`, `plannotator-last`, `plannotator-cancel` with source `extension`; `xd://personal_commit`; all nine skills; the always-applied `# Personal policy`; spawned `markdown-oxide`, `svelteserver --stdio`, and `Microsoft.CodeAnalysis.LanguageServer --stdio --autoLoadProjects`, never `marksman`; with only `package.json` and no Roslyn executable, neither Svelte nor Roslyn started.

## Official standalone binaries

The unchanged harness ran against the official binary from `https://omp.sh/install --binary`, installed into disposable directories:

| Host | Binary | Result |
|---|---|---|
| Korolev WSL, x86_64 | `omp/18.8.0`, ELF using the NixOS `nix-ld` loader | 16/16 OK (before the rollback test existed) |
| macbook-pro, arm64, macOS 26.6.2 | `omp/18.8.0`, Mach-O arm64 | 17/17 OK, including forward rollback |

The WSL binary depends on `/lib64/ld-linux-x86-64.so.2`, which NixOS provides only through `nix-ld`. Fleet change 4 must keep a `nix-ld` loader for it.

## Real sessions (task 5.2, 2026-10-07)

All sessions ran the official `omp/18.8.0` binary with no wrapper, `--extension` or `--plugin-dir` flags, and plugin `0.2.0` installed from the published marketplace. Discovery used disposable profiles; model-backed turns used each host's real profile, because provider authentication lives there and is never copied.

- Tern on macbook-pro: Tern 0.6.0 (`tern serve` with `tern ctl`) in a disposable repository. Typing `/personal` listed the six `personal:opsx-*` commands, and a `personal_commit` preview printed `would commit in: …/repo`, the subject `chore: verify release smoke` and its body verbatim.
- Tern for Windows 0.6.0 on Korolev WSL: the integrating session itself runs `/home/user/.local/bin/omp` in Tern and loads its skills from `~/.omp/plugins/cache/plugins/glockyco___personal___0.2.0`; the owner's screenshot shows the six `/personal:opsx-*` commands in Tern's completion list.
- Workflow command, RPC mode, disposable Git repositories on Korolev WSL and macbook-pro: `/personal:opsx-explore Which OpenSpec changes exist in this repository? …` arrived as the expanded command template ("Enter explore mode. Think deeply. …"), the agent ran `openspec list --json` (`no_openspec_root`, as expected without an OpenSpec root) and answered; `git status --porcelain` stayed empty and the fixture commit unchanged.
- Release prompt, RPC mode, disposable repositories on Korolev WSL, macbook-pro and the Windows desktop: the agent read `skill://commit-policy` from `…/glockyco___personal___0.2.0/skills/commit-policy/SKILL.md`, read the writing skill's `references/examples/index.md` (`# Example Bank Index`), and wrote `xd://personal_commit` with `action: preview`; the preview output was reported verbatim and the repository stayed unchanged before and after.

Every temporary profile, repository and session driver was deleted afterwards.

## Language servers (task 5.3, 2026-10-07)

Real RPC sessions on both hosts, official `omp/18.8.0`, plugin `0.2.0`, disposable fixtures:

| Check | Korolev WSL | macbook-pro |
|---|---|---|
| Markdown Oxide 0.25.12: unresolved-link diagnostic, definition, references, rename from a body symbol (renamed `note.md` and updated the link) | pass | pass |
| Marksman | binary absent, never selected | disabled, never selected |
| Svelte 0.17.31: TS2322 diagnostic, definition, references, rename | pass | pass |
| Roslyn 5.12.0-1.26426.8 | not selected despite a root `.csproj` (`No language server found`) | real HotRepl clone: CS0029, definition, 24 references, rename across 13 files, post-rename diagnostics |

Roslyn's first diagnostic during cold project load returned `Operation aborted`; RPC `get_state` still answered within 0.15 s while that request was outstanding, and every later request passed. Python, TypeScript, JavaScript, Nix and LaTeX also passed on both hosts. BibTeX citation navigation failed on both hosts for a reason outside this plugin: OMP 18.8.0 opens `.bib` files with language ID `plaintext` (its extension table maps only `tex`), and a direct texlab 5.25.1 probe resolves `\cite{acceptance}` to `refs.bib` when the file is unopened or opened as `bibtex`, but not when opened as `plaintext`.

## Publication and published install (tasks 6.1, 6.2)

With the owner's authorization, `3eead69` was pushed to `main` and tagged `v0.2.0` (annotated tag object `e1fb09c`); the catalog advertises `personal` `0.2.0`. GitHub CI on `3eead69`: `check (ubuntu-latest)` passed, but `check (macos-15)` never finished and was cancelled after two hours. Reproducing `checks.aarch64-darwin.release-gate` on macbook-pro showed the cause: after the language-server observation the gate stopped reading the pseudo-terminal and waited for OMP to exit, while macOS keeps an exiting process alive until its unread terminal output drains. `ec41f51` closes the terminal before reaping the session; the same Darwin check then ran 17 tests in 30.6 s on the Mac and 17 in 52.2 s on Linux, and both CI jobs passed on `ec41f51`. That commit changes only `tests/`, so the published `0.2.0` payload is unchanged.

Published re-fetch on Korolev WSL into a disposable HOME: `omp plugin marketplace add glockyco/omp-agent-setup` and `omp plugin install --scope user personal@glockyco` installed `personal@glockyco`, scope `user`, version `0.2.0`, at the profile's `plugins/cache/plugins/glockyco___personal___0.2.0`. The release gate's discovery assertions found nothing missing, the full language fixture spawned `markdown-oxide`, `svelteserver` and `Microsoft.CodeAnalysis.LanguageServer`, and the profile was removed.

The same commands then installed `0.2.0` from GitHub into the real user profiles on Korolev WSL, macbook-pro, the Windows desktop (after `omp update` from 18.1.12 to 18.8.0) and native Windows on Korolev.

## Handoff (task 6.3)

nix-config's README (`## OMP`) and its desktop runbook carry the exact install, upgrade and restart commands and the `/personal:opsx-*` names; `make-korolev-windows-native` quotes the same commands verbatim and keeps the native-Windows annotation lifecycle as its own gate. nix-config still consumes `lib.openspecCheck` through its pinned `personal-omp-plugin` input and installs Roslyn on Darwin only. Previous Nix generations and the retired source generations stay in place until change 1's live gates pass.
