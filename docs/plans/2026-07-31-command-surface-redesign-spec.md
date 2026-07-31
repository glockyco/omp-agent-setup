---
title: Command Surface Redesign Spec
type: spec
status: active
created: 2026-07-31
parent: 2026-07-31-setup-maintenance-overview
superseded_by:
archived:
---

This change adds one safe OMP update workflow while improving diagnosis and audit evidence without growing the public maintenance surface.

## Command surface

The public maintenance scripts remain `bootstrap`, `doctor`, `verify`, `audit-lsp`, `install-lsp`, `update-impeccable`, and `update-plannotator`. `update-omp` replaces the undocumented `plans` package wrapper, so the count remains seven. Developer scripts `ci` and `fix`, CI composition scripts `check:*`, deployed `omp-plans`, and Impeccable natural-language commands are unchanged.

`update-omp` accepts no operational arguments. `--help` and `-h` print `usage: bun run update-omp`. Any other argument prints the same usage and exits 2 without invoking OMP. The workflow records a non-empty version before and after these fail-fast stages:

1. `omp update`
2. repository bootstrap
3. repository doctor
4. repository verify

The first nonzero exit code stops the workflow and is returned unchanged. Spawn, signal, and version-read failures are normalized through the existing CLI error boundary. Raw `omp update` flags remain an expert interface, not part of the repository command.

## Impeccable diagnosis

The Impeccable update and doctor paths share one read-only inspector for the Pi provider, forbidden Markdown markers, readable vendor-fix targets, and applied vendor-fix signatures. The inspector returns stable ordered issues and treats filesystem failures as findings. The updater converts those findings into one aggregate assertion error after its existing copy, rewrite, and fix ordering. Doctor reports every issue and never mutates or crashes on a missing or dangling tree.

## Hook audit pilot

The managed Impeccable extension calls the vendored `writeAuditLog` API after successful direct edit/write results and settled terminal agent events. It records skips and clean results even when no reminder is emitted, while preserving event filtering, one-time failure notification, reminder delivery, and fail-open behavior.

Local ignored configuration enables project-specific NDJSON logs in the Erenshor and ancient-kingdoms-mods repository roots. The pilot remains until both projects have three real UI-editing sessions and 20 `PostToolUse` records. Review occurs no earlier than 14 days and measures detector duration percentiles, skip reasons, clean acknowledgements, finding and rule counts, terminal continuations, logged failures, and audited-path coverage against completed frontend diffs.

## LSP audit output

Healthy LSP entries render `name -> resolved-path` using the path already calculated by the audit. Runtime resolution, installer channels, gap grouping, remediation output, and binary probing remain unchanged. No version or channel provenance probes are added.

## Acceptance

- `update-omp` emits version and stage events in order, stops after each possible failed stage, and the CLI rejects unsupported arguments without invoking OMP.
- README and agent guidance make `update-omp` the normal OMP update path and retain direct `omp update` plus bootstrap only as recovery.
- Doctor reports a healthy live Impeccable tree with its vendor-fix count and reports every fixture issue without mutation.
- Hook tests parse one `PostToolUse` and one `Stop` record from the actual vendored audit writer while reminder behavior stays unchanged.
- Both pilot repositories receive project-specific audit records without tracked or unignored local files.
- LSP fixtures and the live audit show absolute resolved executable paths while missing-binary remediation is unchanged.
- Focused checks, the repository CI gate, the real update workflow, and final live audits pass.
