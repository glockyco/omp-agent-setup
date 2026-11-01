# Design

## Context

The vault tool keeps secret values away from the model by delivering them as files and redacting delivered values in every output. It treated the username like any other field.

## Goals / Non-Goals

**Goals:**

- An agent can tell entries with the same name apart from the search result alone.

**Non-Goals:**

- Showing any secret field, or relaxing redaction for passwords, TOTP secrets, notes or custom fields.

## Decisions

### Show username and URIs in search

They are the fields that identify an account, and Bitwarden itself shows them in its entry list. Notes and custom fields can hold secrets, so they stay hidden.

### Stop redacting usernames

A value that search shows cannot be secret, and redacting it also replaced it in the person's messages, which hid the very detail needed to pick the entry. Deliveries from before the change are no longer registered either, because reloading skips username labels.

## Risks / Trade-offs

- [Risk] Usernames, often email addresses, reach the model provider. They are identifiers, not credentials, and the person approved showing them.
