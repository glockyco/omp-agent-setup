## ADDED Requirements

### Requirement: Vault commits from either machine

The `notes` skill SHALL have agents commit all pending vault changes, not only their own, on whichever machine they work, after a pull with rebase, and push right away. It SHALL have them leave out files changed in the last 15 minutes, because another session or Obsidian may still be editing them.

#### Scenario: Another session left changes

- **WHEN** an agent commits the vault while another session's edit from an hour ago is pending
- **THEN** the commit includes that edit

#### Scenario: A file is still in work

- **WHEN** a pending file changed five minutes ago
- **THEN** the agent leaves it out of the commit
