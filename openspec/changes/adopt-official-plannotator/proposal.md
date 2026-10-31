# Proposal

## Why

Plannotator's own OMP plugin, `@plannotator/pi-extension`, does more for review work than this plugin's adapter. Ask AI from a review runs as a turn in the session, agents can open reviews themselves, `/plannotator-last` offers a picker of recent replies, files open in place with the diff since the last review, and one review can hold several files. The adapter cannot reach the session from the CLI it launches, and every Plannotator change needs adapter work. Its feedback header, "not approval or an instruction to apply edits", also confused agents, because many annotations are instructions to act. Both plugins register `/plannotator-annotate` and `/plannotator-last`, so they cannot run side by side.

## What Changes

- Remove the Plannotator adapter: the extension, its commands `/plannotator-annotate`, `/plannotator-last` and `/plannotator-cancel`, its tests and fixtures, and its entries in the release tree and gate.
- Withdraw the unapplied change `annotate-html-and-images`, which widened the adapter.
- Point the README at the official plugin, which hosts install with OMP's plugin manager.
- Release the result as a new minor version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `omp-visual-feedback`: every requirement is removed, because the official plugin owns annotation.
- `personal-omp-plugin`: release verification and repository hooks no longer name annotation commands or annotation process tests.

## Impact

`plugin/extensions/plannotator.ts`, the Plannotator tests and fixtures, `scripts/release.ts`, `tests/release_gate.py`, the release-tree and plugin-load tests, the README, the marketplace descriptions and the three version fields. Hosts install `@plannotator/pi-extension` before upgrading to this release, so annotation stays available. nix-config owns that installation and the Plannotator configuration.
