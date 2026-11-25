# Tasks

## 1. CI

- [x] 1.1 Remove the macOS job from `ci.yml` and from the workflow test. Verify with `bun run check:local`.
- [x] 1.2 Update the specs that name macOS CI. Verify with strict validation.
- [x] 1.3 Remove `check (macos-15)` from the required checks of `main`. Verify that the pull request can merge after Linux, Windows and OpenSpec pass.
