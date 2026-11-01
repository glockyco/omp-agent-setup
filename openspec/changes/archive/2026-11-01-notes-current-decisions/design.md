# Design

## Context

`Conventions.md` in the vault defines what an item's Notes hold, and the notes skill points agents to it. The skill's first Write line summarized the conventions in its own words and named history among what Notes keep, which the conventions no longer say.

## Goals / Non-Goals

**Goals:**

- The skill and `Conventions.md` agree on what Notes hold.

**Non-Goals:**

- Rewriting existing Notes sections, which the sessions working on each item do.
- The documentation rule's sentence on vault notes, which covers daily notes as well and stays true.

## Decisions

### Point to the conventions instead of summarizing them

The line keeps the one fact agents need when the documentation rule pulls the other way, that notes keep dates and who decided what, and leaves the form of Notes to `Conventions.md`. A summary in the skill went stale once, and the conventions can change without a plugin release.

### Drop the sentence on the Resume line

The always-applied project handoff rule defines the `Resume here:` line, so the skill no longer repeats it.

## Risks / Trade-offs

- [Risk] An agent reads the skill without `Conventions.md`. Mitigation: the skill already directs agents to the conventions note before they change the vault.
