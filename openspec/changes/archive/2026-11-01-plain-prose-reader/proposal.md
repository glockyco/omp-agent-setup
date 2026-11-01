# Proposal

## Why

The plain-prose rule covers punctuation, filler and hedging, but the feedback on wording since 2026-10-08 asked for something else in every project: the reader's own words instead of terms like "Returns" or "It comes without support", only what the reader needs instead of explanations of simple numbers or edge cases, clear sentences instead of convoluted ones, and a plain tone instead of a lofty one. Rules that banned surface signs did not get there. Wording modeled on how someone who knows the subject would say it to the reader did.

## What Changes

- The plain-prose rule opens with one line: write what this reader needs to know or do, in the words they use, as someone who knows the subject would say it to them, and leave out what they don't need.
- Archive `notes-current-decisions`, which both hosts run in 0.11.6.
- Release the change as 0.11.7.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the plain-prose rule asks for the reader's needs and words.

## Impact

Every session on an upgraded host reads the line in its system prompt, for documentation, comments, commit messages and chat. A session that started before the upgrade keeps the previous rule until it restarts.
