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
8. Apply the answer and record a case in the notes vault, in the notes of the item the decision belongs to: the question, the options with a link to the comparison, the answer verbatim, the outcome and the date. Keep anything you infer from the answer apart and labelled as inferred. When applying an answer raises another question, such as a fact that changes the approved option, ask it as a new comparison in Plannotator, not in chat.
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
