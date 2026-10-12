## Context

OMP drops context files named AGENTS.md when it spawns a task subagent, and it loads a repository's AGENTS.md only for sessions started inside that repository. Subagents do inherit the parent's discovered rules, and plugin rules are discovered in every session. The plain-prose rule already relies on this.

## Goals / Non-Goals

**Goals:**

- One short rule about what documentation contains, reaching main sessions and subagents in every repository.
- Verification that names the rule when it goes missing.

**Non-Goals:**

- A documentation skill, templates or a length limit.
- Rules for manuscripts, which follow their own conventions.

## Decisions

**A plugin rule, not AGENTS.md or RULES.md.** AGENTS.md never reaches subagents. A user `~/.omp/agent/RULES.md` is local to one machine and unversioned. A project `.omp/RULES.md` reaches only sessions started inside that repository, and every repository would need its own copy. OpenSpec's per-artifact `rules` in `openspec/config.yaml` cover only artifact creation and are also per repository. The plugin is versioned, installed on every host and loaded everywhere.

**Always applied.** Documentation is written during many tasks, not one recognizable writing task, so a skill would load too rarely. A TTSR rule triggered by Markdown edits would reach the writer at the right moment but interrupt output and, by default, fire once per session. The rule stays short to keep its cost in every prompt low.

**Separate from plain prose.** Plain prose governs punctuation in all prose. This rule governs what documentation contains and where everything else goes. Each can be verified and removed on its own.

**The rule text.** The rule ships as `plugin/rules/documentation.md`, headed `# Documentation`.
