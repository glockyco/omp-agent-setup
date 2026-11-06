# Tasks

## 1. Delegate vault conventions

- [x] 1.1 Apply the approved project handoff, notes skill and documentation rule replacements.
- [x] 1.2 Raise the root, plugin and marketplace versions to 0.11.13.

## 2. Validate and prepare the release

- [x] 2.1 Validate the delta strictly, archive it with accepted specs, and run check:local and the full native gate.

Local validation: strict change validation and `check:local` passed. The full native gate passed all 212 behavior tests, adapter and OpenSpec checks, and the production audit. Installed-release validation stopped because the checkout's Python 3.15.0b2 does not meet the existing stable-3.15 prerequisite. Required CI supplies the release verification.
