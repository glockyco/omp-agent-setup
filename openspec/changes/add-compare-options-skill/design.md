# Design

## Context

The loop ran on nine comparisons in `bloodline-compendium`, kept in its Git-ignored `artifacts/design/process/`. Each comparison was a Markdown file with screenshots or quoted text and one Plannotator `:::question` card per decision, and the answers came back as session messages through Plannotator's OMP plugin. An evaluation of that trial, answered on 2026-10-31, chose a skill in this plugin with one always-applied line, factual instead of short sentences in plain-prose, and case records in the notes vault with the comparisons staying in each project. The vault's conventions put a record that has no properties and no dated work of its own into the note it belongs to, as a section or list. The plain-prose rule must not route writing to a skill, so the new line needs its own rule.

## Goals / Non-Goals

**Goals:**

- Any agent or subagent that writes text players see, or makes a visible design choice, in a game project meets the procedure without having seen the trial.
- Decisions accumulate as cases that a later decision in any project can find.

**Non-Goals:**

- Style rules, banned words or register defaults. Findings from one comparison stay in its case.
- Scientific writing, documentation, commit messages and chat. Other rules and skills cover them.
- Automating the person's judgment. Model reviewers check facts and find defects.

## Decisions

### The skill holds the procedure only

The skill text:

````markdown
---
name: compare-options
description: Use before shipping text that players see or a visible design choice in a game project, including text written inside other work, such as a known issue, a label or the reason a value is unknown.
---

# Compare options

A person decides text that players see and visible design choices from a few options. Agents frame the decision, gather references, draft, check facts and record the outcome. Model reviewers check facts and find defects, because they have not been able to judge voice or look.

1. Frame one decision on the real page with the real data, and name the player's question it answers. Small decisions on one page can share a comparison, with one question card each.
2. Find how strong references handle the same situation, such as large game wikis or pages a person approved, and quote them with links. They inform this decision only.
3. Draft two to four options that differ in structure, plus the current version. Check every fact, and test behaviour in the game, because code is easy to misread.
4. Mark one option as recommended with a one-sentence reason, and offer "None of these".
5. Write the comparison as a Markdown file in the project, outside Git when the repository is public, and open it in Plannotator. Show each option where it appears, with screenshots of the real page for layout. When Plannotator cannot open, give the file's path and ask in chat.
6. Apply the answer and record a case in the notes vault, in the notes of the item the decision belongs to: the question, the options with a link to the comparison, the person's words verbatim, the outcome and the date. Keep anything inferred from it apart and labelled as inferred.
7. Before the next decision, search the vault for earlier cases that apply, also from other projects, and say what transfers. Earlier cases, and specs and designs written by agents, are evidence, not authority.

A subagent that drafts such text gets this skill's path and returns options. It does not commit, push or deploy them.

## Question card

Plannotator shows each card with its choices, a field for another answer and a note, and returns the answers at the top of its feedback.

```markdown
:::question
Where should a bug show on an item page?

Recommended: B: one sentence about this item, beside the game card

- [ ] A: the entry's title and its sentence about every affected item
- [ ] B: one sentence about this item, beside the game card
- [ ] None of these

Why: the bug changes what the game card says, so the correction belongs beside it.
:::
```
````

Alternatives: a `reader-text` skill with positive style guidance, and a shared shelf of references with a `mood-board` skill. Both were withdrawn before the trial, because they would turn one review's findings into standing rules without a way to revise them.

### A separate always-applied rule triggers the skill

A skill loads only when an agent recognizes its situation, and the trial's failures were text written while the agent was doing something else. One always-applied rule, `plugin/rules/compare-options.md`, costs a few lines in every session and names the situation:

```markdown
---
alwaysApply: true
description: Send text players see and visible design choices in game projects through a comparison a person decides.
---

# Compare options

In game projects, such as reference sites and mods, text that players see and visible design choices ship only after a person picks them from a comparison. This covers text written inside other work or by subagents, such as a known issue, a label or the reason a value is unknown. Follow the `compare-options` skill.
```

Alternative: a line in each repository's `AGENTS.md`. Sessions started outside a repository and their subagents never load it, which is how the Bloodline session missed it.

### Cases live in the item's vault note

A case is a dated entry in the notes of the item the decision belongs to, such as `Comparisons decided on 2026-10-31:` in a project note, because a case has no properties or dated work of its own. A vault search finds cases from every project. Comparison files and screenshots stay in the project, outside Git when the repository is public, because they hold the person's words and third-party screenshots.

Alternative: one topic note for all cases. It would separate cases from the decisions their project note already records.

### Plain prose asks for factual sentences

The last line of `plugin/rules/plain-prose.md` becomes "Factual sentences without filler or hedging." The rule otherwise stays as it is.

### Verification with a fresh agent

As with `persona-trials`, a fresh agent receives only the skill and a realistic task: wording a known-issue entry for a bug that helps the player. Its plan passes when it gathers references, drafts options that differ in structure with the current text, marks a recommendation with a reason, plans a Plannotator review and a vault case, and ships nothing. The skill is revised where the plan misses a step.

## Risks / Trade-offs

- [Risk] Agents read earlier cases as rules. Mitigation: step 7 calls cases evidence and asks what transfers, and inferences stay labelled.
- [Risk] Small text changes wait for a review. Mitigation: one comparison holds several question cards, and each took minutes in the trial.
- [Risk] The skill names Plannotator, which an SSH session on Korolev cannot open in a browser. Mitigation: step 5 falls back to the file path and a question in chat.
- [Risk] The skill and rule change only through review, so they lag behind new lessons. Mitigation: a complaint that the loop should have caught leads to a change of the skill, with the case that showed it.

## Migration Plan

Release as 0.11.0 and upgrade the Mac, then Korolev once SSH works. The Bloodline trial's case files move into the Bloodline vault note outside this change. Rollback is a downgrade to 0.10.0.
