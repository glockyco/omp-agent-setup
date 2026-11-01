# Proposal

## Why

The `Resume here:` line of the Ancient Kingdoms Compendium note grew from 75 words on 2026-10-27 to 348 words on 2026-10-31, over 15 versions that agents wrote. One session rewrote it 11 times and each time replaced only its own sentences, so six sentences that another session wrote on 2026-10-29, about content the developers asked to keep unpublished and about three bugs found in an audit, passed through all 11 rewrites word for word. The note itself had no tasks: the line held about eight steps as prose. It also repeated what Workbench shows, such as "24 commits through aaeb3965, not pushed" beside Workbench's flag of 25 unpushed commits, and it told what happened on three dates. Its first sentence, which the review shows for an item without a next step, was about a deployment two days earlier.

The handoff rule causes this. It asks for a line "so that a session with no other context can continue from it", which makes every fact belong in the line, and it names no other place for a fact except tasks for dated steps. Workbench has handed a linked session the note's steps, waiting follow-ups and repository work since 2026-10-26, so the line no longer has to carry them. The notes skill adds "Keep dates, history and who decided what" without limiting it to the Notes section. Six other items have lines of more than 100 words, up to 292, while the median is 40.

## What Changes

- The project handoff rule asks for a new `Resume here:` line that says where each piece of work in progress stands, in a sentence or two each, because Home shows the line under the item's next step and the review shows its first sentence. The line leaves out work that is finished or not started yet, and the steps, decisions, commits and checks that the note's tasks and Notes, Git and Workbench already show. Every fact of the old line that the new line leaves out, including facts that other sessions wrote, gets a place: a step tracked by an OpenSpec change or an issue stays there, any other step or a fact that calls for one becomes a task with its date when it has one, waiting becomes a `#waiting` task, a lasting decision or constraint goes under Notes with its date, and history and what Git, the repository and Workbench already show are left out.
- The rule describes what Workbench returns when it links a session, and a session without the tool reads the whole note instead of only the line.
- The notes skill keeps dates, history and who decided what in Notes sections and daily notes, and says that a `Resume here:` line holds only the current state.
- The vault's conventions note defines the line the same way. It lives outside this repository and changes together with this change.
- Release the change as a patch version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: The project handoff rule writes the `Resume here:` line from the current state and gives every other fact of the old line its place.

## Impact

Every session on an upgraded host writes handoffs this way, and long lines shrink as sessions next work on their items. Home's next step changes for items whose steps move from the line into undated tasks, because Workbench takes the first undated task as the next step. A session that started before the upgrade keeps the previous rule until it restarts. Hosts keep the previous behavior until they upgrade, and Korolev receives the release once SSH to it works again.
