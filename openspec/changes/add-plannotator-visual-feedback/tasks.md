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
- [x] 3.3 Record the reviewed plugin revision and parent integration evidence after verification; do not publish, activate, synchronize specs, or archive without the required authorization and completed acceptance.

## Verification evidence

Implementation checkpoint: `0e39f18`. Cross-repository evidence is recorded in `nix-config/openspec/changes/add-plannotator-visual-feedback/evidence.md`.

- `nix develop --command bun run ci` passed: lint, types, dead-code check, production audit, and 28 Bun tests. The audit found no vulnerabilities.
- `nix flake check --print-build-logs` passed on `x86_64-linux`, including 28 immutable-payload Bun tests and 9 Python tests. Native Darwin checks were not run.
- `openspec validate add-plannotator-visual-feedback --strict` passed.
- Real OMP sessions resolved the same `local://` name to distinct document contents. Cancelling one review left the other available.
- The corrected immutable package started an idle feedback turn and queued busy feedback after the active turn. Exactly two feedback messages produced the expected three-response sequence. Source bytes remained unchanged.
- The compatible upstream fix is local commit `420ee6c`. The actual browser survived a brief reconnect and dismissed after sustained disconnection, using a 30-second client lease grace. A never-connected review remained available after 47 seconds and required explicit cancellation.
- The real child ignored inherited sharing, port, host, and browser overrides. Its listener used a random loopback port with sharing and gate mode disabled.

These checks used managed Linux Chromium and temporary wrapper overrides. They do not replace the parent change's Windows-browser/Herdr, macOS, publication, production-pin, activation, network, or rollback gates. No repository was published, no host was activated, and no change was archived.
