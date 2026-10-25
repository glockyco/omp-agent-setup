# Proposal

## Why

Agents describe repositories by who they belong to: a README opened with "An Obsidian plugin for the owner's notes vault", runbooks say "the owner types the password", and this plugin's own skills speak of "the owner's weekly review". The rule against such phrases covered only commit messages. A reader of documentation needs to know what the system does and what to do, and a third person makes the text read as if it were written about someone else.

## What Changes

- The documentation rule requires documentation for people to describe the system and address its reader, without describing a person such as "the owner", "the user" or "the maintainer". Agent instructions phrase what needs a person's decision as an instruction, such as "Ask before publishing".
- The `notes` and `weekly-review` skills and the README's release flow follow the rule.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: the documentation rule and the notes vault skills.

## Impact

`plugin/rules/documentation.md`, `plugin/skills/notes/SKILL.md`, `plugin/skills/weekly-review/SKILL.md` and `README.md`. Generated OpenSpec adapters keep their upstream wording.
