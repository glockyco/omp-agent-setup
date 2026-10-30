# Proposal

## Why

Agents need project secrets such as API keys and web logins from Bitwarden vaults. Today a person has to fetch each value and paste it, which puts the value into the conversation and into the model provider's request. OMP's own secret obfuscation only knows values that exist when a session starts or that match well-known token shapes, so a value fetched during a session is not covered.

## What Changes

- A `vault` extension with one `vault` tool. The agent searches entry names, asks for a field, and receives the path of a private file that holds the value. The value never appears in tool arguments or tool results.
- Masked OMP prompts handle login, two-step codes and unlock. The unlock key is cached in the OS keystore until local midnight.
- The first use of each entry asks once: allow always, allow once or deny. Decisions are remembered.
- Every value the extension delivers is replaced with a label in tool results, in the context sent to the model and in the final provider payload.
- Vault state lives under `~/.omp/vault/`. `bw` becomes an optional host prerequisite.

## Capabilities

### New Capabilities

- `vault-access`: Bitwarden login and unlock, entry approval, file delivery and redaction of delivered values.

### Modified Capabilities

- `personal-omp-plugin`: the plugin declares a third extension and may keep vault state under `~/.omp/vault/`.

## Impact

- New `plugin/extensions/vault.ts`, its manifest entry and tests.
- README and AGENTS.md: the vault capability, the `bw` prerequisite and the scoped `~/.omp/vault/` state.
- Release version bump.
