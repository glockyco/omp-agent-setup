# Proposal

## Why

Agents split one announcement into several posts and repeated its link in sessions 01a19419 (2026-10-31) and 01a1a110 (2026-11-05). The vault's 15-minute exclusion also stopped an agent from committing its own finished edits in session 01a19c14 (2026-11-02), although it exists to protect other sessions' work in progress.

Recording every comparison answer in the vault with quotes and change history bloated item notes and duplicated repository specs. Recording what changed and when left contradictory decisions in Notes. In sessions 01a1748d, 01a197fb and 01a1a110, agents replaced todo lists with `todo init` while work remained open.

## What Changes

- Keep one topic in one post, with several images when needed and its link once, in step 1 of the compare-options skill.
- Limit the notes skill's 15-minute exclusion to files changed by another session or Obsidian, and commit the current session's finished edits right away.
- Raise the plugin version to 0.11.12 in all three release manifests.
- Search repository specs as well as vault notes for earlier comparison decisions, and record the current rule in the repository's OpenSpec specs or active change when it has a repository, otherwise in the item's Notes.
- Replace outdated notes in place, retaining decision dates and decision makers without a change log.
- Preserve open todos when adding requests or side tasks and restrict whole-list initialization.
- Archive and sync the completed change, push, obtain required CI and release v0.11.12 under the approved release authorization.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: keep announcements together, commit finished vault edits, maintain current decisions in their governing source, and preserve open todos.

## Impact

The compare-options and notes skills, documentation and personal-policy rules, and their behavior contracts change. No runtime code, dependencies or delivery mechanisms change. Pushing and releasing v0.11.12 is authorized.
