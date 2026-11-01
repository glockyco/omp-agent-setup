# Proposal

## Why

Since 2026-10-31, text that players see and visible design choices in the game projects have been decided through small comparisons in Plannotator: options drawn from strong references, a marked recommendation and a recorded case. Over 18 questions the recommended option was chosen 12 times, and each comparison was answered within minutes. Text written inside other work still skipped the loop, because the loop lived in one session and a Git-ignored folder. A subagent started from a session outside the repository carries the plugin's rules and skill list in its system prompt, but not the repository's agent instructions. The plain-prose rule's call for short sentences also matches the uniform sentences that the writing research found on the Bloodline site.

## What Changes

- Add a `compare-options` skill with the procedure: frame one decision on real data and read the whole page, ask of every element whether the reader needs it there, read earlier cases from the notes vault, model wording on text that people wrote and take only structure from the other game projects, draft two to four options that differ in structure plus the current version with behaviour observed in the game, check every option against the project's written rules and approved wording, recommend the option judged best with a reason that holds, ask in Plannotator with inspected screenshots while naming the decision in chat, record the case in the notes vault, and keep approved parts when an answer rejects the options. The agent drafts the options itself, and subagents return such text as options without shipping it.
- Add an always-applied rule that sends text players see and visible design choices in game projects through the skill before they ship.
- Change the plain-prose rule's last line from "Short factual sentences without filler or hedging." to "Factual sentences without filler or hedging."
- Check the skill and the rule in the release-tree validation, the plugin-load test and the release gate, and name the workflow in the README.
- Release the change as a new minor version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Ship the `compare-options` skill and its rule, and ask the plain-prose rule for factual instead of short sentences.

## Impact

Sessions and their subagents on upgraded hosts carry the rule and discover the skill from any working directory. The skill uses Plannotator's question cards and the notes vault, which both hosts already have, and adds no runtime dependency. Korolev receives the release once SSH to it works again, together with the remaining host steps of `adopt-official-plannotator`. Hosts keep the previous behavior until they upgrade.
