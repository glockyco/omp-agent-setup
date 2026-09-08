## Why

The personal OMP plugin needs browser-based document feedback without restoring the Plannotator Pi extension or an approval workflow. The separately authorized workstation change requires a session-safe adapter in this repository.

## What Changes

- Add `/plannotator-annotate <document>`, `/plannotator-last`, and `/plannotator-cancel` to the immutable plugin.
- Review private UTF-8 snapshots through `plannotator annotate <snapshot.md> --json` and return non-empty annotations once as queued user feedback.
- Use OMP's native session-local resolver and current branch entries to preserve source identity.
- Cancel reviews on navigation and shutdown, own child-process cleanup, and restrict invocation to local interactive sessions.
- Update narrow host declarations, affected package checks, behavioral regressions, and existing usage documentation.

## Capabilities

### New Capabilities

- `omp-visual-feedback`: Annotation-only commands, source snapshots, session-bound feedback, cancellation, and the local subprocess boundary.

### Modified Capabilities

None. The existing immutable package and capability-isolation contracts remain unchanged.

## Impact

Implementation affects `plugin/extensions/plannotator.ts`, the plugin manifest, development host declarations, plugin tests, flake checks, and the README. Runtime code uses only APIs available in OMP's Bun process.

The parent change is `nix-config/openspec/changes/add-plannotator-visual-feedback`. Its five planning artifacts define the cross-repository contract. User authorization covers this companion change and implementation, but not publication, activation, or upstream submission. The workstation owns executable selection through an on-demand, commit-pinned vendor package. The adapter uses the stock CLI without a downstream client-lease patch. Closing a browser tab can leave the review pending until `/plannotator-cancel`, session navigation, or shutdown. Automatic tab-close dismissal is not a release requirement.

## Non-goals

No installer, updater, publisher, fallback executable, full Pi extension, approval mode, planning transition, automatic source edits, code-review commands, PR commands, remote browser access, or generated OpenSpec adapter changes.
