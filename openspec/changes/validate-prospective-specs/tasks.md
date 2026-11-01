# Tasks

## 1. Shared gate

- [x] 1.1 Add disposable archive simulation and strict resulting-spec validation to the reusable workflow and local harness.
- [x] 1.2 Add executable regressions for an overlong requirement, all open changes, archive failure, no open changes and unchanged source artifacts.
- [x] 1.3 Document the shared CI guarantee and local-hook boundary in README.

## 2. Acceptance

- [x] 2.1 Prove the throwaway overlong case passes existing delta checks but fails the new gate, and run current live callers through it.
- [ ] 2.2 Run the complete native gate and obtain all required CI checks without a plugin release.
