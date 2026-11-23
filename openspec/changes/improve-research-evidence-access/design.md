# Design

## Context

See [proposal.md](proposal.md) for the motivation and [evidence.md](evidence.md) for the measurements. The skill is one Markdown file with one bundled helper, `fetch_pdf.py`, which uses only the Python standard library and is tested against local HTTP fixtures. Subagents load the skill in 112 of 117 transcripts with literature work, so text in the skill reaches the agents that do the fetching. The `vault` tool delivers a secret to a private file and blocks any tool call whose arguments contain the value.

## Goals / Non-Goals

**Goals:**

- Agents stop spending calls on hosts that never answer.
- The person learns when a copy is not the published version.
- OpenAlex answers on days with heavy use.
- Each rule is checked in a way that fails when the rule stops working.

**Non-Goals:**

- A change of the acquisition order. Sci-Hub stays second.
- A search helper, bulk search or survey procedure. Those belong to `add-literature-survey`.
- Host configuration. The workstation repository sets `UNPAYWALL_EMAIL`.
- Automatic use of the browser session by the helper.

## Decisions

1. Put the refusing hosts into the skill as a short list with one route each. The alternative is to let agents discover refusals, which is what the history shows: every subagent repeats the attempt. A block in the harness would be stronger, but the plugin must not patch OMP. A host enters the list only when the history shows repeated refusals, and each route is run once against that host before it is written down.
2. Semantic Scholar goes on the same list. Its only regular use was a link to an open-access PDF, which the open-access lookup already provides.
3. Give the manuscript case its own word and exit status. The helper prints `MANUSCRIPT` in place of `OK`, saves the file and exits with status 3. Failing outright would throw away a copy that the person may approve. Printing `OK` is the current behavior and hides the case. The helper tells a preprint DOI from a published one by the genre in the open-access metadata and by the arXiv DOI prefix. An unknown genre counts as published, because a needless question costs less than an unnoticed manuscript.
4. Keep the acquisition order. The history shows that Sci-Hub delivered one work from 2022 on. Skipping it for recent years would save time that nobody measured, and the accepted order is deliberate. The manuscript result covers the consequence: for recent works the agent asks the person or uses the browser session.
5. Report a failed open-access lookup as its own condition. The helper keeps trying later sources, and its final message names the lookup failure.
6. Deliver the OpenAlex key through `vault` as a raw value in a private file, and build the bearer header in the command from that file. A query parameter would put the key into tool arguments, which the vault blocks. An environment variable would keep working but leaves the key readable by every process and invites URLs with the key. OpenAlex states that a personal key also signs in to the account, so it gets the same care as a password.
7. Take `UNPAYWALL_EMAIL` from the host only. Agents chose two different addresses in the history. The helper already refuses to run without the variable, so the change is one sentence in the skill.
8. State the HTML rule in general terms and name no hosts. Which hosts serve readable full text changes, and the agent sees at once whether a page holds the paper.
9. The published-version check uses sources the skill already names: DBLP, OpenAlex locations and the journal reference of the arXiv record.

## Verification

Three kinds of check, because a script and a skill text fail in different ways.

- The helper changes get fixture tests in `tests/test_fetch_pdf.py`: the manuscript status for a publisher DOI, an ordinary success for posted content, and the lookup-failure message.
- The skill text gets real trials with fresh subagents, in the manner of the `persona-trials` skill. Each trial gives the agent one task from the history and the candidate skill, and a second agent gets the released skill as the baseline. The tasks are: obtain the abstract and full text of a work that only a refusing host serves, register a preprint that has a published version, acquire a recent work whose DOI yields only a manuscript, and run a keyed OpenAlex search. A trial passes when the transcript shows no request to a listed host, the published version in the registered entry, a question to the person, and no key in any tool argument. The results go into `evidence.md`. No trial harness stays in the repository.
- After the release has been in use for four weeks, the history measurement runs again. Refused reads of the listed hosts, addresses typed into helper commands and keyless OpenAlex searches should be near zero. The script that produced `evidence.md` is kept in this change so that the second run counts the same things.

## Risks / Trade-offs

- A listed host can start answering, or a new one can start refusing. The list then misleads or misses. Mitigation: the repeated measurement shows both, and a list entry is cheap to change.
- A preprint server other than arXiv can report an unexpected genre and trigger a needless question. The cost is one question per such work.
- Until the hosts set `UNPAYWALL_EMAIL`, acquisition by DOI stops with a report. Mitigation: the host setting lands before this release is installed.
- Without the Bitwarden entry, OpenAlex searches stay keyless and can be refused. The skill reports that state.
- Subagents need the vault to be unlocked and the entry approved. The approval is remembered per entry, and the unlock lasts until midnight.
- Trials show how agents act on these tasks, not that every agent follows the skill. The repeated measurement covers real use.
