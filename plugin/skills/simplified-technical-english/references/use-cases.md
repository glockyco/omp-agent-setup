# Use cases beyond documentation

STE was built for maintenance manuals. The same properties help any technical text where misreading has a cost.

## Error messages and CLI output

Mode: procedural. State what happened in simple past. State the known cause. Give the corrective command.

> Before: Oops! Something went wrong while attempting to establish a connection. Please ensure your credentials are properly configured and try again.
>
> STE-based: Connection to the database failed. The password for user `app` was not correct. Set `DB_PASSWORD` and connect again.

## Runbooks and operating procedures

Mode: strict procedural.

- Use an imperative for each step.
- Put each condition before its command.
- Put each warning before the affected step.
- Keep each sentence at 20 words or fewer.

## Incident reports

Mode: descriptive. Use simple past for a timeline. State known measurements and write *unknown* for facts that are not known.

> Before: We have identified an issue that may have impacted some users' ability to access the service.
>
> STE-based: Between 14:02 and 14:31 UTC, 12% of requests failed. A deploy at 14:00 removed the cache warmup step.

## Commit messages and pull requests

Use an imperative subject. Use a descriptive body that explains the reason for the change. Delete phrases such as *this change aims to*.

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
