# Tasks

## 1. Cleanup correctness

- [x] 1.1 Add deterministic regressions for delayed exit, persistent survival, unrelated refusal and process-query failure.
- [x] 1.2 Handle the specific unsupported-operation race with a bounded creation-qualified exit wait.

## 2. Acceptance

- [x] 2.1 Prove the transient-exit regression fails without the fix and passes with it, then run the native gate.
- [ ] 2.2 Obtain green Windows CI for the issue-closing pull request without a plugin release.
