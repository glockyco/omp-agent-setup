# Design

## Context

The session history of the Windows host from 2026-09-03 to 2026-11-24 holds 75 episodes of literature work in 35 sessions. They start in the middle of other work, ran a median of 23 minutes, and 13 ran over an hour. The person kept talking in the same conversation while they ran. The history also holds 45 status questions such as "Still going?" in 20 sessions, mostly during other long runs, and accidental interruptions ("hit ESC by accident"). Results mostly serve later agent sessions: a paper's `sources.json`, `annotated-bibliography.md` and `literature-review.md` come up in 25 to 29 sessions each.

## Decisions

### The survey runs as a program, with models through OMP

`omp auth-gateway stdio` answers `/v1/chat/completions` requests on JSON lines with the credentials and roles of the user's OMP, and needs no listener or token. The survey starts it once per run and sends the plan request to `@default` and the screening requests to `@smol`, as the kernel's `completion` did. Answers are parsed as the first JSON object in the reply, because not every provider honours `response_format`. The gateway takes about 30 seconds to start, which a run of minutes absorbs.

The program keeps its functions, so the eval route still works and the tests keep injecting fake model calls. The command line passes a gateway-backed `completion` with the same interface.

Alternatives: an OMP extension tool would also survive messages, but needs model access in TypeScript and its own progress surface, while a background `bash` job gets OMP's job widget, `notify` and completion delivery as they are.

### Status, registry and stop are files

`status.json` in the survey directory holds the question, depth, state, last step, counts and times, and is rewritten at every step and every 30 seconds while the run lives. The registry is one JSON line per survey directory in `~/.cache/research-evidence/surveys.jsonl`, or `RESEARCH_EVIDENCE_REGISTRY` when set, beside the shared pacing directory. A `stop` file in the survey directory ends the run at its next step with the state `stopped`, and a later run continues it. Files work the same from the agent, a shell and Tern, need no process ids and survive a crash: a `running` status that has not changed for two minutes reads as interrupted.

### The Tern plugin reads those files

The host half reads the registry and the status files every three seconds and offers the widget `surveys`. A host widget renders in the session daemon and reaches every window attached to it, so the Mac shows the surveys of Korolev. The hover card is about 300 pixels wide and cuts each row to one line, and a row's label shrinks with its text, so each survey takes two rows: the question, then the state, a short detail and the buttons. Blocked and failed surveys get a Details button for `status.json` instead of Results and Coverage, since they wrote neither. The window half toasts when a survey of its own machine ends, because only hooks with a context can toast and the window half has one in its timers. It starts polling when it loads, because a plugin reloaded in an open window gets no new `window_start`.

The plugin lives in `tern/research-surveys/`, outside `plugin/`, because the OMP payload holds only what the plugin manager installs. Hosts install it with `tern plugin install github.com/glockyco/omp-agent-setup/tern/research-surveys`, which takes the default branch.

### Surveys stay with their item

The skill puts a survey directory in the folder of the vault item it serves, and looks there for earlier surveys before it starts a new one. A second run on the same directory already continues the first. This keeps results where later sessions of the item look, without a central index.

## Risks

- The Tern plugin API is young. The widget call exists in Tern 0.9.29 but not yet in the published guides, so a Tern update may need changes.
- The gateway's start time and the provider's JSON adherence are outside this repository. A reply without a JSON object fails that screening batch, whose records stay undecided as before.
