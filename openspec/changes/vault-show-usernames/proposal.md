# Proposal

## Why

Vault entries are often named after a site, so a vault can hold several entries with the same name, such as three named `github.com`. Search showed only names, ids and field names, so an agent could not tell which entry belongs to which account, and it signed in to the wrong accounts twice. Delivered usernames were also redacted everywhere, including in the person's own messages, so the person could not even name the right account to the agent.

## What Changes

- Search shows each entry's username and URIs besides its name, id and field names.
- A delivered username is no longer redacted. Passwords, TOTP secrets, notes and custom fields stay redacted.
- Release the change as 0.11.8.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vault-access`: search shows usernames and URIs, and redaction covers only secret fields.

## Impact

Agents can choose the right entry without asking. Usernames, often email addresses, now reach the model provider in search results and delivered files.
