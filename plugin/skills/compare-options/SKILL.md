---
name: compare-options
description: Use before shipping text that players see or a visible design choice in a game project, including text written inside other work, such as a known issue, a label or the reason a value is unknown.
---

# Compare options

A person decides text that players see and visible design choices from a few options. Agents frame the decision, gather references, draft, check facts and record the outcome. Model reviewers check facts and find defects, because they have not been able to judge voice or look.

1. Frame one decision on the real page with the real data, and name the player's question it answers. Ask whether that reader needs the element on that page and what they can do with it, also when an agent or a model reviewer added it. Small decisions on one page can share a comparison, with one question card each.
2. Search the notes vault for earlier cases that apply, also from other projects, and say what transfers. Earlier cases, and specs and designs written by agents, are evidence, not authority. Then find how strong references handle the same situation, such as large game wikis or pages a person approved, and quote them with links. They inform this decision only.
3. Draft two to four options that differ in structure, plus the current version. Check every fact, and test behaviour in the game, because code is easy to misread.
4. Check every option against the project's written reader-text rules and the wording a person already approved, and show that check in the comparison. Then mark one option as recommended with a one-sentence reason that is true of it, and offer "None of these".
5. Write the comparison as a Markdown file in the project, outside Git when the repository is public, and open it in Plannotator. Show each option where it appears, with screenshots of the real page for layout. When Plannotator cannot open, give the file's path and ask in chat. In chat, name the decision, the options and the recommendation, not only the link.
6. Apply the answer and record a case in the notes vault, in the notes of the item the decision belongs to: the question, the options with a link to the comparison, the person's words verbatim, the outcome and the date. Keep anything inferred from it apart and labelled as inferred.

A subagent that drafts such text gets this skill's path and returns options. It does not commit, push or deploy them.

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
