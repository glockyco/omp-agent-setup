# Design

## Context

See proposal.md for the failure. OwnedTree already identifies Windows processes by PID and creation time. Taskkill's unsupported-operation refusal can race with the process query while a terminated process remains visible.

## Goals / Non-Goals

Keep cleanup strict and deterministic without changing the installed plugin or bypassing the real terminal regression.

## Decisions

After a failed taskkill, recognize only unsupported-operation reasons with no mixed unknown error or access denial. Poll the existing creation-qualified survivor query for at most one second using a monotonic deadline and short sleeps. Return only after the original identity disappears. Do not retry taskkill or broaden the existing accepted nonforce refusals. Preserve the original diagnostic on timeout and propagate query errors.

Use mocked survivor snapshots and monotonic time to reproduce transient exit, persistent survival, PID reuse, unknown/mixed failures and query failure on every host. The existing real terminal test and Windows CI remain end-to-end acceptance.

## Risks / Trade-offs

A process query may itself take longer than the one-second polling deadline. Its existing subprocess timeout still bounds that call, and failures remain visible. Persistent refusal adds only the bounded wait to the failing gate.
