# Spec Delta

## ADDED Requirements

### Requirement: One topic per announcement

The `compare-options` skill SHALL have the agent keep one topic in one post, with several images when needed and its link once, because readers should not piece one announcement together from several.

#### Scenario: Announce one topic with several images

- **WHEN** an agent prepares one announcement that needs several images and a link
- **THEN** the skill directs it to keep the topic and images in one post with the link once

## MODIFIED Requirements

### Requirement: Vault commits from either machine

The `notes` skill SHALL have agents commit all pending vault changes, not only their own, on whichever machine they work, after a pull with rebase, and push right away. It SHALL have them leave out files that another session or Obsidian changed in the last 15 minutes, because they may still be editing them. It SHALL have agents commit their own finished edits right away.

#### Scenario: Another session left changes

- **WHEN** an agent commits the vault while another session's edit from an hour ago is pending
- **THEN** the commit includes that edit

#### Scenario: A file is still in work

- **WHEN** another session or Obsidian changed a pending file five minutes ago
- **THEN** the agent leaves it out of the commit

#### Scenario: The current session finished its edit

- **WHEN** an agent finishes its own vault edit less than 15 minutes ago and no other session or Obsidian changed that file in the last 15 minutes
- **THEN** the skill directs it to commit that finished edit right away
