# Proposal

## Why

A review on 2026-11-01 compared the rules with what the person asked for in recent sessions, and four requests had no rule behind them:

- Questions still reached the person in chat, although they asked for decisions in Plannotator twice. Only one vault note recorded the request, and the compare-options skill covers only questions inside a comparison.
- No rule asked a session to wait for the checks after a push, and four dependency pull requests had failing checks nobody looked at, although the person had asked agents to keep an eye on CI.
- The first Ko-fi gallery drafts skipped the compare-options skill, because its rule names text that players see and a gallery item read as outside it. The drafts read machine-written until they went through a comparison.
- Commit messages named task numbers on 48 lines since 2026-10-17, across three repositories, although the person asked on 2026-10-16 that they don't, because task numbers repeat across changes and plans get renumbered.

## What Changes

- The personal policy asks for decisions, approvals and answers in Plannotator as question cards with a marked recommendation, and in chat only when Plannotator cannot open.
- The personal policy asks to wait for the checks after a push and to fix or report a failure.
- The compare-options rule and the skill's description name posts about the games, such as Ko-fi gallery items.
- The commit-policy skill names the work a commit does instead of its task number.
- Release the change as 0.11.5.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the personal policy covers questions in Plannotator and checks after a push, and the compare-options rule covers posts about the games.
- `structured-commit`: commit messages name the work instead of task numbers.

## Impact

Sessions on upgraded hosts ask in Plannotator, wait for checks after pushing, compare post text before it ships and leave task numbers out of commit messages. A session that started before the upgrade keeps the previous rules until it restarts.
