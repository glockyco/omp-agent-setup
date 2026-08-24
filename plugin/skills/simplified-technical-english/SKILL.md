---
name: simplified-technical-english
description: Write, rewrite, or audit clear technical prose with traceable ASD-STE100 Issue 9 principles. Use for documentation, plans, proposals, designs, specifications, tasks, commit and pull request text, comments, docstrings, API descriptions, CLI and error text, procedures, runbooks, release notes, incident reports, agent instructions, and explicit STE requests.
license: MIT
metadata:
  standard: ASD-STE100 Issue 9 (January 2025)
  audit-status: verified-against-official-issue-9
---

# Simplified Technical English

Use ASD-STE100 principles to make technical text clear and difficult to misread. Do not claim ASD-STE100 compliance unless a qualified human audits the text with the official standard and dictionary.

Read these references before a strict request or rule audit:

- `references/standard.md`: authority, dictionary boundary, audit status, and compliance limits.
- `references/rules.md`: the complete 53-identifier paraphrase and technical-term rules.
- `references/checklist.md`: deterministic review sequence.
- `references/use-cases.md`: adaptations for software work.

## Workflow

1. Select **pragmatic** or **strict** mode.
2. Classify each passage as **procedural** or **descriptive**.
3. Select one term for each concept before you draft.
4. Apply the rules in `references/rules.md`.
5. Preserve all protected technical text.
6. Run `references/checklist.md` before delivery.

When you audit text, report the rule identifier, offending text, and rewrite for each violation. Cite only identifiers in `references/rules.md`.

## Modes

| Mode | Use | Boundary |
|---|---|---|
| Pragmatic (default) | Technical prose that must be clear | Apply structural rules. Keep necessary domain terms. |
| Strict | The user explicitly requests STE or compliance | Apply structural and vocabulary discipline. Require the official dictionary and qualified human approval for a compliance claim. |

## Software prose

Use pragmatic mode for documentation, plans, proposals, designs, specifications, task descriptions, commit and pull request text, comments, docstrings, API descriptions, CLI text, errors, release notes, incident reports, and agent instructions.

Apply the rules only to prose that you add or materially revise. Do not rewrite unrelated comments, docstrings, or documentation.

## Text classes

| Property | Procedural | Descriptive |
|---|---|---|
| Purpose | Tell the reader what to do | Explain what a thing is or does |
| Verb form | Imperative | Simple present, past, or future |
| Sentence limit | 20 words (5.1) | 25 words (6.3) |
| Unit | One instruction per sentence (5.2) | One topic per paragraph (6.5), six sentences maximum (6.6) |

Do not mix both classes in one passage. A note in a procedure is descriptive and cannot contain an instruction.

## Protected technical text

Do not rewrite these items:

- code blocks and inline code;
- identifiers, commands, flags, and paths;
- quoted errors and log lines;
- product names, endpoint names, and configuration keys;
- format-required keywords such as `MUST`, `SHOULD`, `MAY`, and `SHALL`;
- numbers with units.

These are technical names under rules 1.5 and 8.6. Apply grammar around them without changing their bytes.

## Default review

Before delivery:

1. Split sentences above the applicable word limit.
2. Remove contractions, complex tenses, unapproved modals, semicolons, and filler.
3. Put each condition before its command.
4. Use one term for each concept throughout the text.
5. Confirm that protected technical text did not change.

For a full audit, use `references/checklist.md`.

## Limits

STE is suitable for technical facts and instructions. It is not suitable for marketing or brand prose because it removes persuasion.

This skill is unofficial. It is not affiliated with or endorsed by ASD or STEMG. No tool can guarantee ASD-STE100 compliance. Final approval rests with a qualified writer who uses the official standard and dictionary.
