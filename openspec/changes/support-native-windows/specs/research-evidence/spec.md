## ADDED Requirements

### Requirement: Host-native acquisition helper invocation

The bundled PDF acquisition helper SHALL be invocable explicitly through host-owned Python 3 on Linux, macOS, and native Windows, including an installed-cache path containing spaces. Its guidance SHALL NOT require Nix, a patched shebang, executable Unix mode bits on Windows, or ambient Python packages. Loading the plugin SHALL not require Python or install the interpreter.

#### Scenario: Run an installed helper on Windows

- **WHEN** a native Windows user invokes the installed helper using host Python and a correctly quoted path containing spaces
- **THEN** deterministic acquisition fixtures execute with the same source precedence, explicit Unpaywall identity, PDF-byte validation, and source metadata as on Linux/macOS
- **AND** invocation requires neither WSL nor Nix

#### Scenario: Python is unavailable at plugin discovery

- **WHEN** OMP loads the personal plugin with no Python executable on PATH
- **THEN** the research-evidence skill remains discoverable without installation
- **AND** guidance identifies Python as an explicit acquisition prerequisite rather than claiming the payload supplies it

#### Scenario: Installed helper loses its asset

- **WHEN** the release no longer contains a readable bundled acquisition script
- **THEN** release verification fails on the missing or unreadable support asset
- **AND** Unix release verification additionally retains its executable-mode check without imposing that mode contract on Windows
