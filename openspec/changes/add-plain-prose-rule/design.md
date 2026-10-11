## Context

The plugin ships one always-applied rule, `plugin/rules/personal-policy.md`. `scripts/release.ts` knows it as the single `RULE` path, and the release gate looks for its heading in a fresh session's system prompt. OMP gives task subagents the parent's rules but not its AGENTS.md files. The Simplified Technical English skill was removed because it routed all writing, scientific writing included, through a controlled style.

## Goals / Non-Goals

**Goals:**

- One short punctuation rule that reaches main sessions and subagents in every repository.
- Verification that names a shipped rule when it goes missing.

**Non-Goals:**

- A writing skill, a controlled language or a manuscript style.
- Enforcement that interrupts model output.

## Decisions

**A separate rule, not more policy.** The personal policy's requirement lists its deviations, and none of them concerns prose. A rule file of its own keeps that contract, and each rule can be verified and removed on its own.

**Always applied, not a skill.** The corrections concerned replies, comments and commit messages, not a recognizable writing task, and skills load only on demand. A TTSR condition rule could interrupt output that contains a typographic character. It would be deterministic, but it would also fire on quoted text and, by default, only once per session. It remains an option if the plain rule proves too weak.

**Manuscripts are exempt.** The thesis and paper sources already use em dashes and clause semicolons: 106 and 42 in phd-thesis, 12 and 7 in Teralizer-Paper. The rule must not push agents to rewrite them or to mix two styles in one document. Code, grammars and quotations keep their punctuation for the same reason.

**The rule text.** The rule ships as written here:

```markdown
---
alwaysApply: true
description: Plain punctuation in prose the agent writes.
---

# Plain prose

Applies to documentation, comments, docstrings, notebooks, commit messages and chat.
Code, grammars, quotations and manuscripts such as papers and theses keep their own
punctuation.

- No semicolons between clauses. Write two sentences.
- Straight quotes and apostrophes only. No em or en dashes, ellipsis characters,
  arrows or section signs.
- No bold lead-ins on bullets and no slogans.
- Short factual sentences without filler or hedging.
```

**Rules are verified like skills.** `scripts/release.ts` lists every rule path, and the gate checks the first heading of each rule file in the system prompt. Removing either rule fails the release-tree validation and the gate, and the finding names the rule.

**A minor release.** The rule adds runtime behavior, so the three version fields move to the next minor version in the commit that adds it.

## Risks / Trade-offs

- Every session pays for the rule's tokens. The rule stays a few lines long.
- A model can still ignore an advisory rule. The gate proves presence, not compliance, and a TTSR guard remains possible.
- Hosts keep the old release until they upgrade. The documented upgrade and a fresh session apply the rule.
