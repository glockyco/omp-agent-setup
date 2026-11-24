# Proposal

## Why

The survey program runs in the eval Python kernel, because it takes its model calls from the kernel's `completion`. A message from the person or a press of ESC stops the kernel and with it the survey. The session history shows this happening, and shows the person asking "Anything still going?" while searches run. A survey in one of several OMP sessions is also invisible from the others, because an idle agent's tab shows it as done.

`omp auth-gateway stdio` serves OMP's own credentials and model roles to a child process over JSON lines, so the survey can run as an ordinary program. As an OMP background job it survives messages, OMP draws a progress widget for it from its output, and `notify` wakes the agent at its milestones. A small Tern plugin can then show every survey of the machine in the widget bar, whichever session started it.

## What Changes

- `survey.py` gets a command line: `run` and `add`. Model calls go through `omp auth-gateway stdio`. Every step prints one line to standard output as well as to `progress.jsonl`.
- A survey writes `status.json` in its directory, records the directory in a per-user registry, and stops cleanly when a `stop` file appears in its directory.
- The skill starts surveys as background `bash` jobs with `notify`, keeps each survey in the folder of the vault item it serves, checks that item's earlier surveys before searching again, and opens `kept.md` beside the chat with `tern open --preview`.
- A Tern plugin, `research-surveys`, kept in `tern/research-surveys/`, shows the surveys of the registry in a widget with buttons that open results and coverage or stop a survey, and toasts when a survey ends.

## Capabilities

### New Capabilities

- `tern-survey-widget`: the Tern plugin that shows running and recent surveys.

### Modified Capabilities

- `literature-survey`: the survey program runs as a command line program with model calls through OMP's stdio gateway, writes a status file and a registry entry, honours a stop file, and is kept with the vault item it serves.

## Impact

- `plugin/skills/research-evidence/scripts/survey.py`, `plugin/skills/research-evidence/SKILL.md` and `tests/test_survey.py`.
- New `tern/research-surveys/` with `plugin.toml`, `host.luau`, `window.luau` and its README. Hosts install it with `tern plugin install`.
- The plugin, marketplace and root package versions advance to 0.14.0.
