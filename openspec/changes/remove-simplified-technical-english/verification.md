# Verification

- `nix build .# --no-link --print-out-paths` produced `/nix/store/w46maz0jvxa7nzil8hkzpjbggb4g7d4y-personal-omp-plugin-0.1.0`. The output has no `skills/simplified-technical-english/`, retains `research-evidence/SKILL.md`, and its policy matches the edited source.
- `nix develop --command bun run check:test`: 28 passed, 0 failed; line coverage 92.31%. A standalone `bun test plugin/tests/plugin-load.test.ts` reported 3 passing tests but exited nonzero because the repository-wide 80% coverage threshold applies even to a single-file run.
- `openspec validate --specs`: 5 accepted specs passed. `openspec validate remove-simplified-technical-english --strict`: passed.
- `nix develop --command bun run ci`: passed formatting, types, dead code, audit, and tests (28 passed).
- `nix flake check`: 7 checks passed on `aarch64-darwin`; incompatible `x86_64-linux` checks were omitted by the local host run.
- A disposable RPC session launched immutable OMP 18.1.10 with the built plugin through `--extension` and `--plugin-dir`, outside the repository, with isolated HOME and XDG directories, no session persistence, and a dummy model key. `get_state` showed the personal policy, without STE routing or STE style guidance. `get_available_commands` showed `commit-policy`, `research-evidence`, and all six OpenSpec skills, but no `simplified-technical-english` skill. The three Plannotator extension commands also registered. The process exited 0; no model prompt was sent.

The workstation still pins its previously published immutable plugin revision. This check does not claim activation or a fresh wrapped-session smoke after publication.
