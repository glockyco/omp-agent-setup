# Proposal

## Why

The Windows installed-release gate fails intermittently when taskkill refuses an already-exiting descendant with an unsupported-operation reason. The gate must distinguish that exit race from a surviving owned process without suppressing genuine cleanup errors.

## What Changes

- Wait briefly for creation-qualified process disappearance after the specific unsupported-operation refusal.
- Keep persistent survivors, access denial, unknown failures and process-query errors visible.
- Add deterministic regression coverage and retain the real terminal descendant cleanup test.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: specify bounded handling of already-exiting Windows cleanup targets.

## Impact

Only development release-gate code, its tests and the accepted contract change. The installed plugin payload and its version remain unchanged. Closes #114.
