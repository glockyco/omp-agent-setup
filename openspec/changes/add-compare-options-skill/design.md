# Design

## Context

The loop ran on the comparisons in `bloodline-compendium`, kept in its Git-ignored `artifacts/design/process/`. Each comparison was a Markdown file with screenshots or quoted text and one Plannotator `:::question` card per decision, and the answers came back as session messages through Plannotator's OMP plugin. An evaluation of that trial, answered on 2026-10-31, chose a skill in this plugin with one always-applied line, factual instead of short sentences in plain-prose, and case records in the notes vault with the comparisons staying in each project. The vault's conventions put a record that has no properties and no dated work of its own into the note it belongs to, as a section or list. The plain-prose rule must not route writing to a skill, so the new line needs its own rule.

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

Before text that players see or a visible design choice ships, ask which of a few options to use. Draft and check the options yourself. Use model reviewers and persona trials to check facts and find defects, not to pick an option, because they cannot judge wording or visual design.

1. Frame one decision on the real page with the real data, and name the player's question it answers. Read the whole page around it, and fix or report what else is wrong there. Small decisions on one page can share a comparison.
2. Ask of every element and sentence in the options whether that player needs it there and what they can do with it, also when an agent or a model reviewer added it. When an element may not be needed, one option leaves it out.
3. Search the notes vault for earlier cases that apply, also from other projects, and say what transfers. An earlier case can be wrong or out of date, and so can a spec or design an agent wrote, so say why one applies before you follow it.
4. Find how strong references handle the same situation and quote them with links. Model the wording on text that people wrote, such as large game wikis, and where a phrasing is in doubt, count how many of their pages use it. For visible design, also look at how the game itself shows the thing. Other game projects in the vault show approved structure, but agents wrote much of their text, so take their structure and not their wording. Show only references that answer this question.
5. Draft two to four options that differ in structure, plus the current version. Write each from the facts and the player's question, and keep the context a player needs to act, because shorter text that drops it is worse. State game behaviour only as observed in the running game, in your own run or a recorded run of the same build, because code is easy to misread.
6. Check every option against the reader-text rules the project has written down and the wording earlier answers approved. In the comparison, say which rule or approved wording an option breaks and which one decides between options. Mark the option you judge best as recommended, with a one-sentence reason that is true of it, and offer "None of these".
7. Write the comparison as a Markdown file in the project, in a Git-ignored folder when the repository is public, and open it in Plannotator. Keep it to what the decision needs: the question, earlier answers verbatim, the references, the options with their check and one question card per decision. Show each option in place, with screenshots of the real page at the same widths. Look at every screenshot as a player would before you show it, and fix or point out defects such as a stray line break. When Plannotator cannot open, give the file's path and ask in chat. In chat, name the decision, the options and the recommendation beside the link.
8. Apply the answer and record a case in the notes vault, in the notes of the item the decision belongs to: the question, the options with a link to the comparison, the answer verbatim, the outcome and the date. Keep anything you infer from the answer apart and labelled as inferred.
9. When an answer rejects your options, fix what it names, look for the same problem elsewhere on the page, and keep what earlier answers approved unless the new answer changes it, because agents tend to overcorrect toward the latest answer.

When a subagent's work includes text players see or a visible design choice, give it this skill's path. It returns that text as options and does not commit, push or deploy it.

## Question card

Plannotator shows each card with its choices, a field for another answer and a note, and returns the answers at the top of its feedback.

```markdown
:::question
How should the knee guards' bug read?

Recommended: A: the armor counts only after another piece

- [ ] A: the armor counts only after another piece
- [ ] B: no armor while they are the last piece
- [ ] None of these

Why: A says when the armor counts and what to do in one sentence.
:::
```
````

Alternatives: a `reader-text` skill with positive style guidance, and a shared shelf of references with a `mood-board` skill. Both were withdrawn before the trial, because they would turn one review's findings into standing rules without a way to revise them.

Three steps came from complaints that the loop should have caught, after the evaluation. A recommended heading broke the pattern of two approved headings, and its stated reason was false. A line about bugs in item link previews had come from a model reviewer, and nobody asked whether someone hovering a link wants it. A message said a decision was still open without naming it. Steps 2, 6 and 7 now cover these.

An audit after Bloodline's About page took five rounds checked the skill against the feedback of 2026-10-26 to 2026-10-31, the recorded cases and the research reports, and checked its own sentences against the signs of AI writing. Drafts modelled on agent-written pages of the other game projects read as machine-written, a true sentence stayed although no visitor needed it, a round after a rejection cut what visitors look for on an About page, shortening dropped context, and a shipped line wrapped where it had room. Steps 1, 2, 4, 5, 7 and 9 now cover these, and the agent drafts the options itself, because delegating key decisions drew complaints. The rewrite also drops sentences that described a person, summarized the steps or read as a slogan, such as "evidence, not authority", and replaces "show that check", which produced a table of identical cells, with naming the rule an option breaks.

### A separate always-applied rule triggers the skill

A skill loads only when an agent recognizes its situation, and the trial's failures were text written while the agent was doing something else. One always-applied rule, `plugin/rules/compare-options.md`, costs a few lines in every session and names the situation:

```markdown
---
alwaysApply: true
description: Text players see and visible design choices in game projects go through the compare-options skill.
---

# Compare options

In game projects, such as reference sites and mods, follow the `compare-options` skill before text that players see or a visible design choice ships. This includes text written inside other work or by subagents, such as a known issue, a label or the reason a value is unknown.
```

Alternative: a line in each repository's `AGENTS.md`. Sessions started outside a repository and their subagents never load it, which is how the Bloodline session missed it.

### Cases live in the item's vault note

A case is a dated entry in the notes of the item the decision belongs to, such as `Comparisons decided on 2026-10-31:` in a project note, because a case has no properties or dated work of its own. A vault search finds cases from every project. Comparison files and screenshots stay in the project, outside Git when the repository is public, because they hold the person's words and third-party screenshots.

Alternative: one topic note for all cases. It would separate cases from the decisions their project note already records.

### Plain prose asks for factual sentences

The last line of `plugin/rules/plain-prose.md` becomes "Factual sentences without filler or hedging." The rule otherwise stays as it is.

### Verification with a fresh agent

As with `persona-trials`, a fresh agent receives only the skill and a realistic task: wording a known-issue entry for a bug that helps the player. Its plan passes when it reads the whole page, asks of every element whether the player needs it, reads earlier cases before drafting, models wording on text that people wrote, drafts options that differ in structure with the current text, checks each option against the project's written rules and approved wording, marks a recommendation with a reason that holds, plans a Plannotator review with inspected screenshots, a chat message that names the decision and a vault case, keeps approved parts after a rejection, and ships nothing. The skill is revised where the plan misses a step.

## Risks / Trade-offs

- [Risk] Agents read earlier cases as rules. Mitigation: step 3 says a case can be wrong or out of date and asks why one applies, and inferences stay labelled.
- [Risk] Small text changes wait for a review. Mitigation: one comparison holds several question cards, and each took minutes in the trial.
- [Risk] The skill names Plannotator, which an SSH session on Korolev cannot open in a browser. Mitigation: step 7 falls back to the file path and a question in chat.
- [Risk] The skill and rule change only through review, so they lag behind new lessons. Mitigation: a complaint that the loop should have caught leads to a change of the skill, with the case that showed it.

## Migration Plan

Release as 0.11.0 and upgrade the Mac, then Korolev once SSH works. The Bloodline trial's case files move into the Bloodline vault note outside this change. Rollback is a downgrade to 0.10.0.
