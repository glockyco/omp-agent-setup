## Context

The plugin already ships always-applied Markdown rules. Its notes skill owns vault access, conventions and commits. The release tree and isolated OMP release gate enumerate rules and observe their headings in the installed system prompt.

## Goals / Non-Goals

Use the existing rule-loading boundary so repository sessions receive the duty without selecting a vault skill. Do not change vault conventions, invent notes for unmatched work or edit other repositories during this release.

## Decisions

Ship `project-handoff.md` with the same frontmatter as the existing rules, and remove the duplicate duty from the notes skill. A rule reaches every session, while the skill remains responsible for how vault edits and commits happen.

Use the repository URL in a note's `links` to locate it. This connects repository sessions to existing notes without introducing another registry.

Extend the release-tree omission cases and installed-prompt observation with the new rule and a missing-rule negative control. These exercise delivery rather than assert prose fragments.

Follow the notes-skills release sequence: obtain all four PR contexts, merge the runtime release, record host acceptance, archive in a separate reviewed change after checks pass, and tag the released commit. Validate the merged commit and archive before publication and upgrade both hosts with fresh-session probes.

## Risks / Trade-offs

The rule adds a vault lookup to relevant coding sessions. Work without a matching note skips the handoff, so it does not create unrelated notes. Vault access and commits retain the existing notes skill's host-specific requirements.
