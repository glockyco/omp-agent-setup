# Proposal

## Why

Coding sessions need credentials for command-line operations and browser logins without deliberately placing vault values in model-visible text or session history. The personal plugin can own private authentication, approval, delivery and accidental-disclosure protection while workstation configuration supplies only the official Bitwarden CLI.

## What Changes

- Add a dependency-free vault extension with separate `scch` and `private` Bitwarden profiles, masked login prompts, end-of-day OS-protected unlock caching and remembered entry approvals.
- Expose names-only discovery and opaque field references. Deliver values through child-only environments, protected files and internally delegated browser fills without plaintext in model-authored tool arguments.
- Keep generic bash, eval, browser and delegation tools usable. Do not turn the extension into a sandbox against deliberately malicious same-user code.
- Add small synchronous known-value scrubbers at tool-result, context and final-provider boundaries. Preserve an encrypted per-session redaction ledger for restart and state known limitations of hook failures, streaming, images and export paths explicitly.
- Add canary behavior tests, actual OMP boundary tests and throwaway-entry host acceptance before real entries.
- BREAKING: replace the blanket prohibition on plugin writes beneath `~/.omp` with a narrow vault-state exception. Keep installed payloads immutable and credentials outside them.
- Add official `bw` as an optional host prerequisite. The plugin creates its own data directories and configures servers. nix-config installs the executable only.

## Capabilities

### New Capabilities

- `vault-access`: Private vault authentication, approval, caching, value-free delivery and accidental-disclosure protection through OMP lifecycle paths.

### Modified Capabilities

- `personal-omp-plugin`: Permit scoped mutable vault state, discover the additional extension and tools, and verify their installed-release boundaries without installing host tools.

## Impact

Implementation will add the vault extension, declare it in the manifest and bump the runtime versions together. Tests stay outside the payload. README and AGENTS.md will explain prerequisites, supported value-free delivery, state ownership and residual risks instead of promising universal redaction.

No upstream OMP changes, runtime npm dependencies, host aliases, manual pre-export workflow or blanket tool restrictions are included. The invariant concerns accidental disclosure during supported use. It is not an OS sandbox against malicious or prompt-injected agent code with shell access. OMP's fail-open output hooks prevent an unconditional guarantee in every failure mode, which the design records rather than conceals.
