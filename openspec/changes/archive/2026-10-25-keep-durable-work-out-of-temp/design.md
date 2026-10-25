## Context

The short personal policy is already always applied. The isolated release gate observes installed rules through a fresh OMP session's system prompt and has missing-rule controls.

## Goals / Non-Goals

Preserve lasting work without changing scratch-work storage or host cleanup settings. Do not add storage automation or recover files in this release.

## Decisions

Add the supplied single bullet to the existing policy instead of creating another rule. This is a short personal deviation with the same loading scope as the policy's existing bullets.

Check the installed prompt for the instruction and remove only that instruction in a negative control. A heading-only check would miss this regression while the personal policy remained loaded.

Release and tag the checked runtime commit. Record host acceptance and sync the requirement in a separate archive PR after all runtime checks pass, following the previous rule release.

## Risks / Trade-offs

The rule relies on agents distinguishing lasting deliverables from scratch files. It states the intended lifetime rather than banning temporary files, so isolated tests and disposable working data remain possible.
