---
alwaysApply: true
description: What repository documentation contains and where everything else goes.
---

# Documentation

Applies to repository documentation such as READMEs, guides, runbooks and agent instructions. Documentation describes the current state for a reader who has to use, operate or change the system. Notes in the `notes` vault are not documentation. They keep dates, history and who decided what, as the vault's conventions require.

- Do not restate facts that live in code or declarations, such as versions, identifiers, paths, inventories and settings. Point to their source.
- Keep evidence, measurements, dates, history and who decided what out of documentation. Put them in the change record: the OpenSpec change, the pull request or the commit message.
- Give a reason in one sentence next to its rule, or as a comment in the code it explains. Longer rationale belongs in the change's design.
- Delete a one-time procedure, such as a migration or cutover, once it is finished.
- Edit documentation in place and remove what a change makes obsolete.
- A plan or specification that changes documentation names what the reader needs to know or do, not facts or evidence to copy into it.
- Describe the system and address its reader. Never describe a person in documentation for people, such as "the owner", "the user" or "the maintainer", because the reader needs to know what the system does and what to do, not whose it is. In agent instructions, phrase what needs a person's decision as an instruction, such as "Ask before publishing".
