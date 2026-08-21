## Why

Nine repositories hold OpenSpec artifacts. Seven verify nothing. The two that do verify hold two hand-written copies of the same check, so the fleet has both a coverage gap and a duplication problem at once.

The gap is not theoretical. An archive was published in `ancient-kingdoms-mods` today carrying five unchecked tasks. It was found by hand.

| Repository | Changes | Specs | Verified today |
|---|---:|---:|---|
| `ardenfall-compendium` | 11 | 13 | no |
| `test-generalization` | 8 | 1 | no |
| `phd-thesis` | 5 | 1 | no |
| `ancient-kingdoms-mods` | 4 | 0 | no |
| `renovate-config` | 1 | 0 | no |
| `erenshor-data-mining` | 0 | 2 | no |
| `HotRepl` | 0 | 3 | no |
| `omp-agent-setup` | 0 | 5 | own copy |
| `nix-darwin` | 2 | 4 | own copy |

The coverage follows the toolchain rather than any decision: the two verified repositories are two of the ones whose CI already runs Nix. Upstream publishes no action for this, so every repository would otherwise wire the commands itself, which is exactly why seven have not.

## What Changes

- Expose the check once, from this repository, as a flake output any repository can consume: a function taking a source tree and producing a derivation that runs `openspec validate --all --strict` and `openspec validate --archived --strict`.
- Adopt it in all nine repositories. Each adds one input and one line, and runs `nix flake check` in CI.
- Delete the two hand-written copies. `omp-agent-setup` and `nix-darwin` consume the shared definition like everyone else.
- Pin the OpenSpec version once, in the shared flake. Consuming repositories pin this flake, not the CLI.
- Give `phd-thesis` and `renovate-config` a check-only flake. Neither gains a development shell, and their existing toolchains are untouched.
- **BREAKING** for the adopting repositories: a commit that leaves an artifact invalid, or archives a change with an unchecked task, now fails CI. `ardenfall-compendium` holds 24 artifacts that have never been validated, so adoption may surface existing defects there.

## Capabilities

### New Capabilities

- `fleet-openspec-validation`: how this repository defines OpenSpec artifact validation for every repository on the workstation, what that validation asserts, and how a repository consumes it.

### Modified Capabilities

None. `personal-omp-plugin` governs the plugin payload, and this check is a flake output rather than part of that payload.

## Impact

- **This repository:** a new shared flake output, and its existing `openspec-contracts` check replaced by a consumption of that output.
- **`nix-darwin`:** its `openspecContracts` check replaced the same way.
- **Five repositories with Nix already in CI** (`erenshor-data-mining`, `HotRepl`, `test-generalization`, plus the two above): one input, one check, one CI step.
- **Two repositories with a flake and no Nix in CI** (`ancient-kingdoms-mods`, `ardenfall-compendium`): the same, plus the Nix installer action.
- **Two repositories with no flake** (`phd-thesis`, `renovate-config`): a check-only `flake.nix` and a CI step. `renovate-config` gains its first workflow.
- **Pull requests required** in `HotRepl`, `erenshor-data-mining`, and `ardenfall-compendium`, whose default branches are protected.
- **Not changed:** the plugin payload, the generated workflow adapters, the `llm-agents` pin that produces them, and every repository's existing hooks.
