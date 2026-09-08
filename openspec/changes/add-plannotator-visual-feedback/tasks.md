## 1. Adapter implementation

- [x] 1.1 Register the three annotation commands and narrow native host declarations; verify discovery in an actual OMP session without requiring Plannotator at startup.
- [x] 1.2 Implement immutable UTF-8 document and current-branch response snapshots; verify paths with spaces, native session-local resolution, unsupported inputs, and visible-text selection.
- [x] 1.3 Implement the annotation-only child protocol and local environment boundary; verify feedback, dismissal, missing executable, startup failure, malformed output, and unexpected decisions.
- [x] 1.4 Bind feedback to session, branch, and snapshot identity; verify exactly-once queued delivery, stale-source warnings, and navigation races.
- [x] 1.5 Own pending status, independent review lifetimes, cancellation, and private cleanup; verify cancel remains available and releases only the selected session's resources.

## 2. Package and regression integration

- [x] 2.1 Replace incidental one-extension checks with required capability discovery and add meaningful behavior regressions; verify the existing commit capability and new adapter in isolated payload execution.
- [x] 2.2 Update the existing README with command usage, supported inputs, cancellation, local-only behavior, and non-goals; verify the instructions against the actual command surface.
- [x] 2.3 Run `nix develop --command bun run ci`, `nix flake check`, and `openspec validate add-plannotator-visual-feedback --strict`; record exact results without claiming unavailable native checks.

## 3. Cross-repository acceptance

- [x] 3.1 Verify real native `local://` resolution in two OMP sessions and a busy-session feedback round trip; record source identity, no source edits, and one follow-up delivery.
- [x] 3.2 Verify the compatible upstream annotation-only lease in the browser, including sustained disconnect, brief reconnect, no initial connection, and loopback-only listeners; record the finite disconnect grace period.
- [ ] 3.3 Record the reviewed plugin revision and parent integration evidence after verification; do not publish, activate, synchronize specs, or archive without the required authorization and completed acceptance.
