## ADDED Requirements

### Requirement: Windows terminal cleanup verifies process exit

The Windows release gate SHALL accept an unsupported-operation termination refusal only when the creation-qualified owned process disappears within a bounded wait. A surviving target, access denial, unknown termination error or process-query failure SHALL remain a gate failure.

#### Scenario: Termination races with process exit

- **WHEN** Windows refuses to terminate an already-exiting owned process with an unsupported-operation reason
- **THEN** cleanup waits briefly for that process identity to disappear and succeeds only after observing its exit
- **AND** it does not terminate a new process that reuses the PID

#### Scenario: Refused target remains alive

- **WHEN** the owned process remains after the bounded wait or Windows reports a different unexpected failure
- **THEN** cleanup fails with the original termination diagnostic

#### Scenario: Process observation fails

- **WHEN** the process query fails during the bounded exit wait
- **THEN** cleanup reports that failure rather than assuming the process exited
