# Tasks

## 1. Native ownership snapshots

- [x] 1.1 Replace shell-based Windows snapshots with fresh native process identities and retain visible query failures.
- [x] 1.2 Pin and group the Windows-only development wheel and add snapshot identity, query failure and real Windows regression tests without removing existing tests or coverage.

## 2. Verification and publication

- [ ] 2.1 Run the complete native gate and obtain green Linux, macOS, Windows and OpenSpec CI checks.
- [ ] 2.2 Record per-part Windows baseline timings and at least three successful before and after Windows job durations.
- [ ] 2.3 Archive this change in the reviewed PR, merge it after green checks and observe main CI.
