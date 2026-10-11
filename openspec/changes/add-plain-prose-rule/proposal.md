## Why

Agents keep writing clause-joining semicolons, typographic quotes and dashes, and formulaic filler in documentation, comments, notebooks, commit messages and chat. In one project alone, the owner corrected this in five sessions within ten days. Subagents, which do not receive a repository's AGENTS.md, wrote most of the violations. Since the Simplified Technical English skill was retired, no shipped instruction covers punctuation.

## What Changes

- Add an always-applied rule, `plugin/rules/plain-prose.md`. It asks for short factual sentences and excludes semicolons between clauses, typographic quotes and apostrophes, em and en dashes, ellipsis characters, arrows, section signs, bold bullet lead-ins and slogans.
- The rule covers documentation, comments, docstrings, notebooks, commit messages and chat. Code, grammars, quotations and manuscripts such as papers and theses keep their own punctuation.
- Keep the personal policy as it is. The new rule is neither a writing skill nor a controlled language.
- Check every shipped rule in the release-tree validation and the release gate, with a negative control for the new rule.
- Release the change as a new minor version.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Ship the plain-prose rule with its exemptions, and discover and verify every always-applied rule, not only the personal policy.

## Impact

The rule is a new file in `plugin/rules/`. `scripts/release.ts`, `tests/release_gate.py`, `tests/release-tree.test.ts`, `tests/plugin-load.test.ts`, `README.md` and the three version fields change with it. Every session and subagent on an upgraded host carries the rule in its system prompt. Hosts keep the previous behavior until they upgrade.
