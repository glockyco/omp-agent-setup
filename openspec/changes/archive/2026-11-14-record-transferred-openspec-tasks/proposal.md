## Why

Unchecked tasks in archived changes fail strict validation. Checking transferred tasks would falsely claim the source change completed them. The installed personal policy needs to preserve the transfer destination without either outcome.

## What Changes

- Record transferred tasks and their destination as plain bullets before archiving.
- Verify the instruction in the installed system prompt, including a damaged-candidate control.
- Publish the policy as a patch release.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: require truthful transfer records before OpenSpec archive.

## Impact

The personal policy and isolated installed-release gate change. Generated OpenSpec adapters remain untouched.
