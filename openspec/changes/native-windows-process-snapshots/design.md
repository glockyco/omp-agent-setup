# Design

## Context

The release gate already owns descendants by PID and creation time. Every Windows snapshot launches PowerShell and enumerates CIM processes, including repeated queries around completed CLI commands. Three recent successful Windows jobs took 493, 466 and 407 seconds. Their installed-release checks took 399.325, 373.902 and 305.019 seconds. Source runs are recorded in verification.md.

## Goals / Non-Goals

Keep all release scenarios, coverage floors, deadlines, settling periods and cleanup assertions unchanged. Do not parallelize tests that share fixtures, cache mutable plugin profiles or change host OMP installations.

## Decisions

Use Windows-only psutil wheels for native process enumeration. This avoids implementing Windows ABI structures and process-query error handling in this repository. Clear process_iter's object cache before each snapshot so cached creation times cannot conceal PID reuse. Retain the existing PID, parent PID and creation-time ownership algorithm and taskkill failure controls.

Missing parent or creation identities fail the query. Other enumeration errors propagate. Silently dropping denied rows could mistake a surviving owned process for a completed cleanup.

Keep the dependency exact and grouped with native Python terminal tooling for reviewed upgrades. No new runtime dependency enters the plugin.

Parallelizing the existing gate would retain its repeated process startup cost and complicate fixture ownership. Caching installs would not address the measured installed-release bottleneck.

## Risks / Trade-offs

A Windows-only binary wheel adds one development dependency. CI retains binary-only installation and tests the actual native query, root exit, orphan descendants, unrelated-session survival, PID reuse, query denial and force-termination errors.
