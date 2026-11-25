# Proposal

## Why

The macOS CI job has not caught a macOS-specific failure in this repository. In its last 199 runs it failed only together with Linux or Windows, and it failed to get a hosted runner 4 times, which turned the run red after a 15-minute wait. GitHub's macOS runners have had capacity shortages since early November. The macOS bugs found so far, such as the refused signal to a finished process tree, were found by running the release gate on the Mac.

## What Changes

- CI runs the native gate on Linux and Windows only. The `check (macos-15)` job and its required context go away.
- The specs that name macOS CI now name Linux and Windows CI. Local checks and the release gate still support macOS.

## Impact

- `.github/workflows/ci.yml`, `tests/native-pins.unit.test.ts` and the main branch protection.
- Specs `repository/ci-path-classification`, `personal-omp-plugin` and `plugin-update-automation`.
