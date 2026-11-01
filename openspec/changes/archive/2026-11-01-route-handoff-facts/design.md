# Design

## Context

A `Resume here:` line is read in three places. Home shows it under an item's next step, the review shows its first sentence for an item without a next step or follow-up date, and Workbench hands it to a session that links to the item, together with the note's steps, waiting follow-ups and the work in its repositories. The vault's conventions note defines the line, and the project handoff rule tells every session to rewrite it before finishing.

Agents wrote 15 versions of the Ancient Kingdoms Compendium line between 2026-10-27 and 2026-11-01. They grew from 75 to 348 words. The session that built Pocket Compendium wrote 11 of them and each time replaced only its own sentences, while the sentences about the Old Valorath request and an audit stayed word for word. The note had no tasks.

## Goals / Non-Goals

**Goals:**

- The line says where the work in progress stands, in a few sentences.
- Every other fact of the old line ends up in an OpenSpec change, an issue, a task, a `#waiting` task or the Notes, or is left out because it is history or Git, the repository or Workbench show it.
- A session treats facts that other sessions wrote the same way as its own.

**Non-Goals:**

- A word limit that Workbench checks.
- How the `compare-options` skill records its cases in Notes sections.

## Decisions

### Write a new line, then place the rest

An agent that did not do another session's work cannot tell whether a sentence about it still matters, and dropping it could lose something, so it keeps the sentence. The rule now asks for a new line from the current state and then a place for every fact of the old line. That turns keep or drop into where it goes, which needs only the kind of fact. A word limit alone was the alternative. It would squeeze the same facts into denser prose and leave steps outside the tasks.

### Size and content follow where the line is read

"A sentence or two for each piece of work in progress" follows from Home showing the line under the next step and the review showing only its first sentence. Finished work and work not started yet stay out, because the first is history and the second is a task. Steps, decisions, commits and checks that the tasks, the Notes, Git and Workbench show stay out too, because the line would repeat them and drift from them.

### Steps become tasks, also undated ones

The previous rule asked only for tasks for dated steps, so undated steps stayed in the line, where Workbench cannot show them as the next step. The conventions already list an item's tasks with the next one first. A step that an OpenSpec change or an issue tracks stays there, because Workbench shows each change with its next task. A fact that calls for a step, such as a game build the site does not cover yet, becomes a task too.

### Lasting decisions go under Notes

A constraint such as content a developer asked to keep unpublished outlasts every session, so it goes under Notes with its date. The notes skill's "Keep dates, history and who decided what" now names Notes sections and daily notes, because the line had collected dated events as well.

### The line no longer stands alone

The previous rule asked for a line "so that a session with no other context can continue from it". Since 2026-10-26 Workbench returns the note's steps, waiting follow-ups and repository work along with the line, and a session without Workbench now reads the whole note.

## Trial

Fresh agents did the handoff on copies of the Ancient Kingdoms note as two sessions: the session that built Pocket Compendium, after the person answered its four review decisions, and a session that posted five Ko-fi gallery items while linked to the item. Every round used the same two session descriptions, the same note, the context Workbench returns and a matching copy of the conventions note. Each agent reported its changes and every place it hesitated, and the counts below come from the files it wrote.

| Rule | Session | Line words | Sentences | Tasks | Old line copied into Notes |
| --- | --- | --- | --- | --- | --- |
| Previous | Pocket Compendium | 114 | 8 | 0 | yes |
| Previous | Ko-fi | 72 | 6 | 0 | yes |
| Round 1 | Pocket Compendium | 79 | 4 | 3 | no |
| Round 1 | Ko-fi | 27 | 2 | 1 | no |
| Round 2 | Pocket Compendium | 33 | 2 | 3 | no |
| Round 2 | Ko-fi | 26 | 2 | 1 | no |
| Round 3 | Pocket Compendium | 18 | 1 | 4 | no |
| Round 3 | Ko-fi | 18 | 1 | 2 | no |
| Round 4 | Pocket Compendium | 26 | 2 | 4 | no |
| Round 4 | Ko-fi | 5 | 1 | 3 | no |

Under the previous rule both agents moved the whole old line word for word into Notes, as "Previous project context" and "Prior project handoff", and the Ko-fi agent's line described its finished posts. The rounds changed the rule as follows:

- Round 1 placed the Old Valorath request under Notes and the audit findings in tasks, but its Pocket Compendium line restated the request and changes that Workbench shows. Round 2 added that the line leaves out what the tasks, the Notes, Git and Workbench show.
- In round 2 the Ko-fi line opened with the finished posts, and both agents dropped the installed game build that the site does not cover yet as repository state. Round 3 left out finished work and work not started yet, and turned a fact that calls for a step into a task.
- In round 3 the Ko-fi agent read "what Workbench already shows" as covering Pocket Compendium itself and left it out of the line. Round 4 named the steps, decisions, commits and checks, and both agents then kept Pocket Compendium in the line and placed every fact of the old line.

Two kinds of hesitation stayed through all rounds. No agent knew the date of the developers' request, so the agents dated the Notes entry with the day of the handoff. And a waiting task without a follow-up date stays undated, which the review then reports.

## Risks / Trade-offs

- An agent can still drop a fact it should have placed. Asking for a place for every fact makes a drop a visible choice, and in round 4 no fact was lost.
- Home's next step changes for an item whose steps move into undated tasks, because Workbench takes the first undated task as the next step.
- Notes sections grow as decisions move there. They hold dated decisions instead of a line that every session rewrites.
- A session that started before the upgrade keeps the previous rule until it restarts.

## Migration Plan

Release 0.11.2, upgrade the Mac, and upgrade Korolev once SSH to it works. The vault's conventions note changes at the same time. The Ancient Kingdoms note is rewritten by hand as the first case, and the other items with lines of more than 100 words are rewritten under the new rule right after the release.
