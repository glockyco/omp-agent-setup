## Context

The approved personal policy rule is already implemented in local commit 4aea68b. It needs a versioned release with an accepted contract and installed-runtime evidence.

## Goals / Non-Goals

Goals:
- Preserve truthful task status and the transfer destination when archiving.
- Deliver the rule through the existing plugin manager.

Non-goals:
- Change generated adapters or weaken archive validation.

## Decisions

Keep the instruction in the always-applied personal policy. This covers archive work without editing generator-owned adapters.

Extend the installed-release prompt observation and remove only this instruction in a negative control. This proves delivery through OMP rather than testing source text alone.

Use a patch release because the change corrects archive guidance without adding a capability.

## Risks / Trade-offs

The instruction relies on agents following policy. Strict archive validation remains the independent check against unchecked tasks.

## Release gate corrections

The native gate's compiled-launcher cleanup exceeded Bun's default five-second hook timeout on Windows. Give that cleanup the existing 30-second integration budget without changing its work or assertions.

The local virtual environment used Python 3.13 while the workflow requires Python 3.15. Recreate the environment with the workflow-selected interpreter rather than weakening the release gate's parity check.
