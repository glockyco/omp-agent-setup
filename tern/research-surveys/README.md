# Research surveys for Tern

A Tern plugin that shows the literature surveys of the research-evidence skill in Tern's widget bar. While a survey runs, the widget shows its step and the share of its screening budget used. Its hover card lists the surveys of the last day with buttons that stop a running survey, open the `kept.md` or `coverage.md` of a survey that ended, or open the `status.json` of a blocked or failed one. A window toasts when a survey of its own machine ends.

The plugin reads the survey registry, `~/.cache/research-evidence/surveys.jsonl` unless `RESEARCH_EVIDENCE_REGISTRY` names another file, and the `status.json` in each survey directory. Stop writes a `stop` file into the survey's directory, which ends the run at its next step.

## Install

On every machine whose surveys you want to see, in a Tern pane on that machine:

```sh
tern plugin install github.com/glockyco/omp-agent-setup/tern/research-surveys --force
```

`--force` replaces an installed copy, which is how an update arrives. Then add the widget with the command palette's Edit widgets…, and show the widget bar if it is hidden. A widget defined on a host also shows in windows on other machines that attach to it.

For development, link the folder of a checkout instead, so that Tern reloads the plugin when a file changes:

```sh
tern plugin link tern/research-surveys
```

`tern plugin types tern/research-surveys` writes the API's type definitions for luau-lsp. The [Tern Plugin SDK](https://docs.stencil.so/tern/) documents the API, and `tern.d.luau` of the installed Tern is the reference for the widget calls.
