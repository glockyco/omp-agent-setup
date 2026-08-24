# Use cases beyond documentation

STE was built for maintenance manuals. The same properties help any technical text where misreading has a cost.

## Documentation, plans, and specifications

Use descriptive passages for context, rationale, design, and requirements. Use procedural passages for tasks and commands. Keep the text classes in separate passages.

Preserve template syntax and required normative keywords. In RFC-style or OpenSpec requirements, terms such as `MUST`, `SHOULD`, `MAY`, and `SHALL` keep their defined meanings.

## Error messages and CLI output

Mode: procedural. State what happened in simple past. State the known cause. Give the corrective command.

> Before: Oops! Something went wrong while attempting to establish a connection. Please ensure your credentials are properly configured and try again.
>
> Rewrite: Connection to the database failed. The password for user `app` was not correct. Set `DB_PASSWORD` and connect again.

## Runbooks and operating procedures

Class: procedural. Use strict mode only when the user explicitly requests it.

- Use an imperative for each step.
- Put each condition before its command.
- Put each warning before the affected step.
- Keep each sentence at 20 words or fewer.

## Incident reports

Mode: descriptive. Use simple past for a timeline. State known measurements and write *unknown* for facts that are not known.

> Before: We have identified an issue that may have impacted some users' ability to access the service.
>
> Rewrite: Between 14:02 and 14:31 UTC, 12% of requests failed. A deploy at 14:00 removed the cache warmup step.

## Commit messages and pull requests

Use an imperative subject. Use a descriptive body that explains the reason for the change. Delete phrases such as *this change aims to*. Preserve Conventional Commit syntax, identifiers, paths, and quoted output.

## Code comments, docstrings, and API descriptions

Apply the rules to prose that you add or materially revise. Do not rewrite unrelated text. Preserve identifiers, types, commands, paths, annotations, and required documentation syntax.

Explain the invariant, constraint, contract, or non-obvious reason. Do not restate code that is already clear.

## Release notes

Mode: descriptive. Give one change in each entry. For a breaking change, give the required action before the risk.

## Agent instructions

Mode: procedural. Give one instruction in each sentence. Use one term for each operation. Put a failure condition before the required action. Replace optional *should* language with a fact or a requirement.

## Support and status updates

Mode: descriptive. State the duration, affected operations, current state, and next known action. Delete apology filler that adds no fact.

## Translation preparation

Mode: strict. One meaning for each word and complete grammar reduce translation ambiguity. A compliance claim still requires the official dictionary and human review.

## UI copy

Mode: procedural with shorter interface limits. Treat labels, commands, and product names as protected technical names.

## Unsuitable text

Do not apply STE to marketing, launch posts, brand writing, or other persuasive prose unless the user explicitly accepts the loss of voice.
