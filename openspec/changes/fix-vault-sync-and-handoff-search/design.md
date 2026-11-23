# Design

## Context

See [proposal.md](proposal.md). `VaultService` keeps a set of vaults it has synchronized in this process and synchronizes only on the first use after an unlock. `lock` clears that set, which is the only way to synchronize again from inside a session, and it also deletes the cached key, so the person has to type the master password. On 2026-11-23 an entry created in the web vault during a session was found only after that detour.

The handoff rule is always applied. Its fallback sentence reads: "Without the tool, find the note whose `links` contain the repository's URL, which a search of `vault://notes/` for the URL finds". On Korolev, `grep` on `vault://notes/` and on `vault://notes` returned no matches for text that the vault holds, while `vault://notes/Projects` returned them. The rule's last line tells the agent to skip the handoff when no note exists.

## Goals / Non-Goals

**Goals:**

- An empty search result means that the vault has no such entry now.
- A failed vault search for an item note cannot be read as a missing note.

**Non-Goals:**

- Creating, changing or deleting vault entries from the tool.
- A separate `sync` action. Nobody should have to know when to call it.
- Repairing the root search in OMP.
- More text in the handoff rule. The rule gets shorter by one mechanism and longer by one condition.

## Decisions

1. Synchronize on an empty search and search once more. The cost is one `bw sync` on a miss, and a miss is where a stale copy matters. Synchronizing before every search would slow each call for no gain. A `sync` action would move the decision to the agent, which cannot know that its copy is stale.
2. A failed synchronization after an empty search raises the existing synchronization failure. Returning "no entries" there would repeat the fault this change removes.
3. The second search is the last. An entry that is still missing is reported as missing, so the tool cannot loop.
4. Remove the search mechanism from the rule and keep the goal: find the note whose `links` contain the repository's URL. The `notes` skill already says how to reach the vault on each host, so the rule points there. A rule that names one route breaks when that route does, as it did.
5. State the difference between "the search found nothing" and "the search did not work" in the rule's last line. That is the one condition an agent cannot infer from an empty result.

## Verification

- Unit tests with the existing fake process runner: an empty list, then a synchronization, then a list with the entry. The result lists the entry, and no unlock prompt appears. A second test keeps the list empty and expects the plain "no entries" result after exactly one synchronization. A third makes the synchronization fail and expects its failure message.
- The rule text is checked by one real trial in a fresh OMP session started through Tern, in a repository whose item note exists, with the `workbench` tool disabled. The trial passes when the session reads the note. A second trial makes the vault unreachable and passes when the session says that it could not read the handoff. Both are recorded in this change.
- The installed-release gate keeps checking that the rule is in the system prompt.

## Risks / Trade-offs

- A typo in a query now costs one synchronization of a few seconds.
- Without a named mechanism, an agent has to read the `notes` skill to reach the vault. That is one read in sessions that lack the `workbench` tool, which are rare.
