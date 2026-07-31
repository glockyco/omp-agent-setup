---
title: Setup Maintenance Overview
type: overview
status: active
created: 2026-07-31
parent:
superseded_by:
archived:
---

This repository keeps each public maintenance command aligned with one operational owner and one failure boundary.

## Goal

Maintain a small, explicit command surface that safely deploys and updates OMP, diagnoses managed-state drift without mutation, and exposes enough runtime evidence to debug the active development fleet.

## Strategy

1. Keep deployment, read-only diagnosis, live verification, component updates, and developer quality gates separate.
2. Compose multi-stage maintenance only when later stages must stop on the first failed prerequisite.
3. Share content invariants between update and diagnosis paths instead of duplicating checks.
4. Add observability at existing extension and audit boundaries without introducing new public commands.
5. Prefer already-resolved runtime facts over new probe or parser subsystems.

## Children

- [Command Surface Redesign Spec](./archive/2026-07-31-command-surface-redesign-spec.md): implemented command, doctor, hook-audit, and LSP output contracts.
- [Command Surface Redesign Plan](./archive/2026-07-31-command-surface-redesign-plan.md): completed implementation and verification tasks.

## Current focus

Collect Impeccable audit-pilot evidence until each selected UI repository reaches three real editing sessions and 20 `PostToolUse` records, with review no earlier than 14 days.
