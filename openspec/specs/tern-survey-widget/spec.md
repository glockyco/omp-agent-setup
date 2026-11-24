# tern-survey-widget Specification

## Purpose
Show the literature surveys of a machine in Tern's widget bar, whichever session started them, so that the person sees their progress and can open their results or stop them without asking an agent.

## Requirements

### Requirement: Survey widget

The Tern plugin `research-surveys` SHALL offer a host widget that shows the surveys of the registry: while any runs, how many run with the step of the latest and the share of its budget screened, and otherwise the result of the latest. A `running` survey whose status has not changed for two minutes SHALL show as interrupted.

#### Scenario: Survey running

- **WHEN** a survey of the registry is running in its first round
- **THEN** the widget shows one running survey, its step and the share of its budget screened

#### Scenario: Survey process gone

- **WHEN** a survey's status says `running` but has not changed for two minutes
- **THEN** the widget shows it as interrupted, not as running

### Requirement: Survey actions

The widget's hover card SHALL list the surveys of the last day with each survey's question and state, and with its core works or, when it could not finish, the start of the reason. Its buttons SHALL open `kept.md` or `coverage.md` of a survey that ended, open `status.json` of a blocked or failed survey, and stop a running survey by writing its `stop` file. A file SHALL open in the window where its button was pressed.

#### Scenario: Stop from the widget

- **WHEN** the person presses Stop on a running survey's row
- **THEN** the plugin writes the `stop` file in that survey's directory

#### Scenario: Results from the widget

- **WHEN** the person presses Results on a done survey's row
- **THEN** its `kept.md` opens in that window

### Requirement: Survey end notice

A Tern window SHALL show a toast when a survey of its own machine ends, with the question and the state it ended in, also after the plugin reloaded in the open window.

#### Scenario: Survey done

- **WHEN** a survey of the window's machine changes from `running` to `done`
- **THEN** the window shows a toast with the question and the core works found

#### Scenario: Plugin reloaded in an open window

- **WHEN** the plugin reloads in an open window and a survey of its machine then ends
- **THEN** the window shows the toast
