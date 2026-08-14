# Verification checklist

Run this pass before delivery. Read rule text from `rules.md`; do not cite identifiers from memory.

## Mechanical checks

| Search for | Violation | Fix |
|---|---|---|
| `'ll`, `'re`, `'ve`, `n't`, `it's` | Contraction (4.2) | Expand it. |
| `has been`, `have been`, `had been` | Perfect tense (3.4) | Use simple past or simple present. |
| `should`, `would`, `may`, `might`, `could` | Unapproved modal (3.2) | Apply the modal guidance in `rules.md`. |
| `is being`, `are being`, `was being` | Progressive passive (3.4, 3.5) | Use active voice and a simple tense. |
| `, making`, `, allowing`, `, enabling`, `, ensuring` | *-ing* clause as a verb (3.5) | Start a sentence with a subject. |
| `;` | Semicolon (8.1) | Write two sentences. |
| `e.g.`, `i.e.`, `etc.` | Latin abbreviation (9.4 guidance) | Use plain text or name the items. |
| ` if ` or ` when ` in an instruction | Trailing condition (5.4) | Move the condition before the command. |

Ignore protected technical text when you run mechanical searches.

## Countable checks

1. Count the words in each sentence. Use 20 for procedures (5.1) and 25 for descriptions (6.3).
2. Use no more than six sentences in each paragraph (6.6).
3. Break noun chains longer than three words with prepositions (2.1).
4. Put one instruction in each sentence unless actions occur at the same time (5.2).

Backticked commands, numbers with units, identifiers, and quotations each count as one word (8.6).

## Judgment checks

1. Classify each passage as procedural or descriptive.
2. Use passive voice only in descriptive text when the agent is unknown (3.6).
3. Put each condition before its command (5.4).
4. Use one term for each concept throughout the text (1.11, 9.4).
5. Put the command or condition before its risk (7.2, 7.3).
6. Keep articles and necessary instances of *that* (4.2, 4.5).
7. Confirm that protected technical text did not change (1.5, 8.6).
8. Confirm that every cited identifier exists in `rules.md`.

## Report format

For each violation, give:

1. the rule identifier;
2. the offending text;
3. an STE-based rewrite.

If the user requested compliance, end with this statement:

> No tool can guarantee ASD-STE100 compliance. Final approval rests with a qualified writer who uses the official standard and dictionary.
