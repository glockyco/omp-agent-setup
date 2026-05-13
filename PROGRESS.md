# Implementation progress

Working log for agents and future-me. Captures decisions and milestones that are not obvious from the commit graph.

## Decisions

- **Implementation core: TypeScript on Bun.** OMP is TypeScript on Bun, so Bun is guaranteed present anywhere this repo is used. The verification step imports OMP's own skill-loader module in-process to detect OMP-internal regressions, which a non-TS implementation could only do via subprocess and stdout scraping.
- **No shell wrappers.** `bun run <command>` is the entry point; a shell layer would duplicate the command surface and historically accreted logic.
- **No runtime dep on `@oh-my-pi/pi-coding-agent`.** Its `types` field points at raw TypeScript source written against a different strictness profile. A local declaration stub in `types/omp.d.ts` covers the API surface we actually use; OMP resolves the real package at runtime inside its own process.
- **YAML merging via the `yaml` npm package.** Preserves keys, ordering, and structure but not all comment placements. Acceptable today because the managed config has no user comments; revisit if user comments inside managed sections become a hard requirement.

## Milestones

- 2026-05-13 — Repository scaffolded and pushed to `glockyco/omp-agent-setup`.
- 2026-05-13 — Backed up pre-existing `~/.omp` state to `backups/20260513T133313Z-pre-cleanup/`, removed broken Superpowers legacy-Pi temp-mirror symlinks under `~/.omp/agent/skills/`, removed stale plugin-manager entries from `~/.omp/plugins/`.
- 2026-05-13 — Replaced the shell-based scaffold with a Bun CLI plus unit and integration tests covering path expansion, managed YAML merge, snapshot planner, symlink planner with stale-link cleanup, plugin manifest parser, verification primitives, the Superpowers bootstrap extension, and an end-to-end bootstrap run against a sandboxed `HOME`.
- 2026-05-13 — Wired Biome, lefthook (pre-commit, pre-push, commit-msg), commitlint, GitHub Actions, Dependabot, and added an MIT license.

## Pending

- Live workstation verification of `bun run verify` against the real `~/.omp` and real plugin checkouts.
- Investigate and fix any Plannotator/Superpowers compatibility issues that surface in live verification.
