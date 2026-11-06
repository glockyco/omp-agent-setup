# Proposal

## Why

Agents split one announcement into several posts and repeated its link in sessions 01a19419 (2026-10-31) and 01a1a110 (2026-11-05). The vault's 15-minute exclusion also stopped an agent from committing its own finished edits in session 01a19c14 (2026-11-02), although it exists to protect other sessions' work in progress.

## What Changes

- Keep one topic in one post, with several images when needed and its link once, in step 1 of the compare-options skill.
- Limit the notes skill's 15-minute exclusion to files changed by another session or Obsidian, and commit the current session's finished edits right away.
- Raise the plugin version to 0.11.12 in all three release manifests.
- Keep this change active and its release steps pending until release is authorized.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: keep announcements together and distinguish the current session's finished vault edits from recent edits by another session or Obsidian.

## Impact

The two skills and their behavior contracts change. No runtime code, dependencies or delivery mechanisms change. No push, tag or release is authorized.
