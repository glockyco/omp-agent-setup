# Design

## Context

`Conventions.md` defines folders, names, properties, tasks and editing for every note in the vault, and the notes skill sends agents to it before they change the vault. Its first section says which rules belong in it. Agents changed it twice without asking, once to describe a plugin's behavior during a plugin upgrade and once together with a change to the project handoff rule.

## Goals / Non-Goals

**Goals:**

- A change to the conventions note reaches the person before it is made.

**Non-Goals:**

- Restating in the skill which rules belong in the conventions note.
- Approval for changes to other notes.

## Decisions

### Ask in Plannotator

The person answers decisions in Plannotator, where a proposal is easier to read and annotate than in chat, so the skill names it. The criterion for what belongs in the conventions note stays in that note's first section, because the notes skill must not restate the conventions.

### A plugin's behavior lives in its README

The change of 2026-10-30 described a plugin's behavior in the conventions note. The documentation rule keeps each fact in one place, where a reader looks for it, and a plugin's README is where its behavior is looked up.

## Risks / Trade-offs

- [Risk] A small fix to the conventions note waits for an answer. Mitigation: one Plannotator page can hold several proposals.

## Migration Plan

Release 0.11.4 and upgrade the Mac and Korolev. The uncommitted line in Korolev's clone is discarded in favor of the released text.
