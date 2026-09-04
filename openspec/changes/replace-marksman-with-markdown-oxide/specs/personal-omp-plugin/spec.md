## ADDED Requirements

### Requirement: Single primary Markdown server

The personal plugin SHALL disable OMP's built-in Marksman definition and SHALL define Markdown Oxide as the only primary server for Markdown files. The plugin SHALL contain configuration only and SHALL NOT install either executable or provide a Marksman alias or fallback.

#### Scenario: Open a Markdown project

- **WHEN** OMP loads the plugin, `markdown-oxide` resolves, and a project matches the declared Markdown root markers
- **THEN** Markdown Oxide starts for `.md` and `.markdown` files
- **AND** diagnostics, definition, references, and rename are available
- **AND** Marksman does not start

#### Scenario: Marksman is also available

- **WHEN** both `markdown-oxide` and `marksman` resolve on `PATH`
- **THEN** the disabled Marksman definition remains inactive
- **AND** Markdown Oxide remains the only primary Markdown server

#### Scenario: Markdown Oxide is missing

- **WHEN** the `markdown-oxide` executable does not resolve
- **THEN** the plugin does not fall back to Marksman
- **AND** it does not install a language server
