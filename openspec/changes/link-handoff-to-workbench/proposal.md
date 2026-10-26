## Why

The project handoff rule makes every session search the notes vault for its repository's URL before it starts. Workbench's omp extension now links each session to its item: at start by the repository, and later through its `workbench` tool, which returns the item's handoff. A rule that keeps searching duplicates that link and cannot follow a session whose work moves to another item.

## What Changes

- Direct agents to link the session with the `workbench` tool when a session works on an item, to rely on the link a session in an item's repository starts with, and to link again when the work moves to another item.
- Keep the vault search as the fallback for sessions without the tool, such as hosts without the Workbench plugin.
- Keep the instructions for finishing a session unchanged.
- Release 0.7.5 so OMP offers the changed rule.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: The project handoff rule links sessions through the Workbench tool and falls back to the vault search.

## Impact

`plugin/rules/project-handoff.md` and the release versions change. The Workbench plugin from `glockyco/obsidian-workbench` provides the tool. Sessions on hosts without it keep today's behavior.
