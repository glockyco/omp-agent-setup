# Design

## Context

The person answered a review of the rules in Plannotator on 2026-11-01 and approved four rule changes as written. A fifth, on the writing style the documentation rule should ask for, is still open and is not part of this change.

## Goals / Non-Goals

**Goals:**

- Each of the four requests reaches every session through a rule or a skill.

**Non-Goals:**

- The writing style of the documentation and plain-prose rules.
- Fixing the failing dependency pull requests, which happens in their repositories.

## Decisions

### Questions go to Plannotator in the personal policy

The policy is the one rule every session reads, and asking is not tied to a skill. The line names the format the compare-options skill already uses, question cards with a marked recommendation, so a question looks the same wherever it comes from. Chat stays the fallback when Plannotator cannot open, as in an SSH session without a browser.

### Checks after a push in the personal policy

The policy already governs pushing, so waiting for the checks belongs beside it. Fixing or reporting leaves the choice to the session, because some failures, such as a flaky test, need an issue rather than a fix.

### Posts in the compare-options rule

The rule's sentence on what counts as text players see gains posts about the games, with Ko-fi gallery items as the example. The skill's description carries the same words, because sessions choose skills by their descriptions.

### Task numbers in the commit policy

The line sits beside the rule that a body explains why, because a task number names where work sat in a plan, not what it does.

## Risks / Trade-offs

- [Risk] Waiting for checks keeps a session busy for minutes. Mitigation: sessions can watch checks in the background and continue other work.

## Migration Plan

Release 0.11.5, upgrade the Mac and Korolev, and verify in a fresh session on each.
