# Design

## Context

The always-applied rules and notes skill both contain vault conventions. See proposal.md for the reason to remove these copies.

## Goals / Non-Goals

- Keep session linking, handoff completion, convention approval and plugin README obligations.
- Do not change vault content or runtime extension behavior.

## Decisions

Refer vault writing and fact placement to `Conventions.md` rather than retaining a shorter duplicate, because even a summary can conflict with the vault's own rules. Keep the handoff entry point always applied so repository sessions still know to read and update their item note.

## Risks / Trade-offs

Agents must read the vault convention to know the current item note rules. The notes skill already requires that read.
