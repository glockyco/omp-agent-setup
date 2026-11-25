## MODIFIED Requirements

### Requirement: Generated adapter freshness

Native Linux and Windows CI SHALL compare payload adapters byte for byte with the centrally pinned npm generator without Nix or checkout mutation. Generator changes SHALL fail the release gate until reviewed and committed. Native regeneration SHALL keep the generator as sole writer. Consumers SHALL NOT use adapter freshness as artifact validation.

#### Scenario: OpenSpec changes generated instructions

- **WHEN** the pinned OpenSpec package would rewrite a generated command or skill in the payload
- **THEN** the release gate fails and identifies the generated adapter drift

#### Scenario: Payload is current

- **WHEN** the pinned generator reproduces the payload exactly
- **THEN** the release gate passes and the working tree is unchanged

#### Scenario: A generated adapter is missing from the payload

- **WHEN** the payload lacks a command or skill the generator produces
- **THEN** the release gate fails

#### Scenario: Native Windows adapter check

- **WHEN** the native Windows contributor or runner checks adapter freshness with the pinned generator
- **THEN** a disposable root reproduces and compares all generated commands and skills without Nix or WSL
- **AND** extra payload adapters and missing generated adapters also fail

### Requirement: Native repository hooks

Repository development and Git hooks SHALL use the pinned native toolchain on Linux, macOS and Windows without Nix. Hooks SHALL retain staged formatting, type checks, commit-message validation, frozen installation and the fast `check:local` pre-push gate. They SHALL use installed tools without fetching missing executables. Every PR SHALL run complete CI on Linux and Windows, with both test sets and the unchanged complete-suite coverage floor.

#### Scenario: Commit from a native Windows client

- **WHEN** a native Windows Git client invokes the installed repository hooks after documented setup
- **THEN** formatting/type checks and commit-message validation run without a Nix shell or WSL
- **AND** a failed applicable hook prevents the Git operation
- **AND** pre-push covers toolchain, lint, types, dead code, release version, deterministic unit tests, adapter freshness and strict artifact validation

#### Scenario: Native Bun has no optional executable alias

- **WHEN** the installed pinned Bun is available as `bun.exe` or `bun` without a separate `bunx` alias
- **THEN** hook installation and npm-bin hook commands use Bun's built-in `x --no-install` subcommand without fetching a tool or adding a host alias
- **AND** real commit-message validation remains authoritative and missing required native tools stay visible failures

#### Scenario: Push runs from a Git hook environment

- **WHEN** the pre-push hook inherits Git's repository-local environment variables
- **THEN** its native child receives the correctly sanitized environment and runs frozen installation plus the fast local gate, without network audit or installed-release download/terminal checks
- **AND** sanitization does not depend on POSIX shell substitution or mutate the parent environment
- **AND** every PR still runs the complete gate, including audit and installed-release checks, on both CI hosts
- **AND** the local unit selector excludes real OpenSpec/commitlint/lefthook/Git command fixtures and compiled executable launchers, while preserving their complete CI and installed-cache coverage
- **AND** real external-toolchain and process-lifecycle integration tests retain explicit 30 s case budgets

#### Scenario: A loaded native workstation pushes a change

- **WHEN** the standard-user host has an endpoint scanner or other live sessions affecting external-toolchain timing
- **THEN** pre-push runs the deterministic unit set without executing real-toolchain integration fixtures
- **AND** the same PR still exercises every integration fixture with explicit 30 s case budgets and unchanged complete-suite coverage on Linux and Windows
