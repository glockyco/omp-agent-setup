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

## Not yet exercised

- Model-backed sessions in Tern (workflow command invocation, `personal_commit` preview, writing-skill read) and real language-server protocol smokes (tasks 5.2 and 5.3) need provider authentication in a real profile. They run with fleet change 1's real-session gates after publication.
- Publication, the published re-fetch, and the CI run on GitHub need explicit owner authorization (section 6).
