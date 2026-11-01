# Design

## Context

A review on 2026-11-01 collected the wording feedback across projects and offered a line for the plain-prose rule, a grammar line for the documentation rule asking for active sentences, or no change. The plain-prose line was chosen.

## Goals / Non-Goals

**Goals:**

- One line that states what the feedback asked for and reaches every kind of prose the rules cover.

**Non-Goals:**

- Grammar rules, such as active voice, which address a symptom.
- Text that players see, which the `compare-options` skill covers.

## Decisions

### A line in the plain-prose rule, not the documentation rule

The plain-prose rule applies to documentation, comments, docstrings, notebooks, commit messages and chat, so one line there reaches all of them. The documentation rule stays as it is.

### Above the punctuation bullets

The line states the aim, and the bullets list the surface rules that follow from it, so the line comes first.

## Risks / Trade-offs

- [Risk] The line is general, so an agent can claim to follow it without changing anything. Mitigation: it names a test the agent can apply to each sentence, whether this reader needs it and would say it this way.
