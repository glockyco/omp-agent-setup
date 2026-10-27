# Design

## Context

The method comes from one run in the `ancient-kingdoms-mods` repository on 2026-10-27, which checked install instructions for a patched MelonLoader build. Two rounds of five agents read the instructions and predicted their actions. Five more agents, run one after another, downloaded the build, installed it into the game folder on the Mac and started the game. What each kind of trial found:

- The reading trials found ambiguous wording, a duplicated download and a missing Steam Deck step. They predicted working installs throughout.
- The real trials found mod pages that still linked to the broken loader, and a Mac install that left the files one folder too deep.
- No agent could find the defect that every new Mac user would hit, because the test bottle already carried the DLL override that MelonLoader needs. Removing the override showed it.
- The agent shell ended background processes when a tool call returned. That killed the game launch and left Steam stuck. Launching through Steam also uploaded the real save to Steam Cloud.
- Personas asked for more explanation in every round. Acting on all of it would have bloated texts that had to stay short.

The plugin's other skills are short procedure files without assets unless they run code. OMP's task tool gives fresh subagents, and `history://` and `agent://` keep their reports.

## Goals / Non-Goals

**Goals:**

- One page that a session can follow for any kind of trial: documents, install instructions, websites through the browser, command-line tools, research artifacts, prototypes for partners, student material and paper drafts.
- Wording for the agent prompts that keeps agents in character and honest, given as a template.

**Non-Goals:**

- Trial tools such as state backup or screenshot scripts. They depend on the product and the host.
- Persona catalogues. Personas belong to each product.
- Review checklists for papers. `research-paper-writing` keeps them.

## Decisions

**A personal skill rather than repository instructions.** The method applies to every repository on both hosts, and a repository copy would drift. The alternative, a section in the personal policy, would load into every session although trials are occasional.

**Describe what tools must do instead of shipping them.** The tools from the first run were macOS and CrossOver scripts for one game. A trial of a website needs the browser tool, and a trial of an artifact needs a clean virtual machine or container. The skill names the duties (give the user's view, map user actions to commands, back up and restore shared state, keep processes alive across tool calls) so that each session builds what its product needs. Shipping scripts would add Windows and macOS variants and tests for code that rarely fits.

**Two kinds of trial, chosen by question.** Reading trials are cheap and answer whether the wording is clear. Real trials answer whether the thing works. The skill says that a reading trial's prediction of success is not evidence of success, because the first run showed predicted successes that failed for real.

**Confirm outcomes independently.** Subagent reports are claims. The skill asks for an independent check, such as logs, files or the rendered page, before a finding changes anything.

**Separate the trial from evidence about users.** Persona results check material. A paper or thesis that reported them as user feedback would misstate its method, so the skill says so in its scope.

**Relation to `research-paper-writing`.** That skill reviews a draft by reading it as a skeptic in the same session. Separate reviewer agents that see only the PDF are a persona trial, and this skill's isolation rules apply to them. The review questions stay in the writing skill.

## Risks / Trade-offs

- [Persona agents share one model's habits, so several personas can miss the same thing] → The skill asks for an environment audit and for direct experiments when a trial cannot reach a defect, as with the DLL override.
- [Real trials can change real state, such as saves, accounts or cloud sync] → The skill requires a backup with a guard, one trial at a time on shared state, and a restore check at the end.
- [The skill could grow into a catalogue of tips] → It keeps to the method. Product details stay in the repository that needs them.

## Migration Plan

Release as a new minor version. Hosts discover the skill after upgrading. Rolling back means publishing a newer version without it.
