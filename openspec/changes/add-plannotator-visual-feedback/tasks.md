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
- [x] 3.2 Cancelled by the approved stock-CLI contract: annotation-only client-lease and disconnect-grace acceptance. The completed patched-browser experiment remains historical evidence below.
- [x] 3.3 Record the reviewed plugin revision and parent integration evidence after verification; do not publish, activate, synchronize specs, or archive without the required authorization and completed acceptance.

- [ ] 3.4 Record parent evidence for the stock on-demand package, browser annotation, explicit cancellation after tab closure, and navigation/shutdown cleanup. Keep native-platform release gates open until exercised.

## Historical verification evidence

Implementation checkpoint: `0e39f18`. Cross-repository evidence is recorded in `nix-config/openspec/changes/add-plannotator-visual-feedback/evidence.md`.

- `nix develop --command bun run ci` passed: lint, types, dead-code check, production audit, and 28 Bun tests. The audit found no vulnerabilities.
- `nix flake check --print-build-logs` passed on `x86_64-linux`, including 28 immutable-payload Bun tests and 9 Python tests. Native Darwin checks were not run.
- `openspec validate add-plannotator-visual-feedback --strict` passed.
- Real OMP sessions resolved the same `local://` name to distinct document contents. Cancelling one review left the other available.
- The corrected immutable package started an idle feedback turn and queued busy feedback after the active turn. Exactly two feedback messages produced the expected three-response sequence. Source bytes remained unchanged.
- The compatible upstream fix is local commit `420ee6c`. The actual browser survived a brief reconnect and dismissed after sustained disconnection, using a 30-second client lease grace. A never-connected review remained available after 47 seconds and required explicit cancellation.
- The real child ignored inherited sharing, port, host, and browser overrides. Its listener used a random loopback port with sharing and gate mode disabled.

These checks used managed Linux Chromium and temporary wrapper overrides. They do not replace the parent change's Windows-browser/Herdr, macOS, publication, production-pin, activation, network, or rollback gates. No repository was published, no host was activated, and no change was archived.

## Approved contract supersession — 2026-09-08

The user approved the stock CLI and removed the downstream client-lease patch requirement. Task 3.2 and the `420ee6c` browser results above describe the superseded experiment, not current release acceptance. Automatic tab-close dismissal and a finite disconnect grace period are no longer required.

The existing adapter invokes annotation-only JSON mode and already cancels on `/plannotator-cancel`, session navigation, and shutdown. A closed tab can leave the review pending. No adapter, executable payload, or test changes are needed for this contract revision. No plugin publication or downstream plugin-pin update is required solely for these documentation changes.

The workstation retains its on-demand, commit-pinned vendor package. Stock-package/browser acceptance and the unrun native release gates remain required. This revision ran no validation, build, test, or native browser checks. Historical evidence does not complete task 3.4.

Subsequent parent verification used stock Plannotator 0.27.12 and the unchanged published adapter in a fresh wrapped OMP session through Herdr. Document and last-response feedback passed in managed Linux Chromium. Explicit cancellation after tab closure removed the listener, and source bytes stayed unchanged. The parent evidence file records package paths and cleanup. Strict validation of this companion change passed. These observations do not complete unrun native-platform or navigation/shutdown runtime gates.
