## 1. Establish the baseline

- [x] 1.1 Record which roots hold `openspec/`, which verify them today, and how. Today: nine hold artifacts, `omp-agent-setup` and `nix-darwin` verify with their own copies, seven verify nothing.
- [x] 1.2 Run both validations against each of the seven unverified repositories and record the result. This decides which need repair before adoption.
- [x] 1.3 Record the OpenSpec version each root would validate with today, so the end state can be shown to use one.

## 2. Build the shared definition

- [x] 2.1 Expose `lib.openspecCheck { pkgs, src }` from this flake, returning a derivation that runs `openspec validate --all --strict --no-interactive` and `openspec validate --archived --strict --no-interactive` with telemetry disabled.
- [x] 2.2 Take the CLI from the `llm-agents` input rather than Nixpkgs, because the Nixpkgs build lags far enough that its `validate` has no `--archived` flag. Record the reason and how to re-test it, not the version that happened to be current.
- [x] 2.3 Assert the flag exists before relying on it, so a CLI that drops `--archived` fails the check instead of quietly proving less.
- [x] 2.4 Narrow the source to the repository's `openspec/` directory with a file set, so unrelated files are neither read nor able to invalidate the result.
- [x] 2.5 Confirm the derivation reports the failing artifact, and for an incomplete archive the change name and count of unchecked tasks.

## 3. Prove the definition before anything depends on it

- [x] 3.1 Prove it fails on an invalid artifact, using a scratch source tree.
- [x] 3.2 Prove it fails on an archived change with an unchecked task.
- [x] 3.3 Prove it passes on a clean tree, and that a change to a file outside `openspec/` reuses the previous result rather than recomputing it.
- [x] 3.4 Prove it runs offline once its inputs are fetched.

## 4. Convert the two repositories that already verify

- [x] 4.1 Replace this repository's `openspec-contracts` check with a consumption of `lib.openspecCheck`, and confirm `nix flake check` still fails on the conditions it caught before.
- [x] 4.2 Convert `nix-darwin`: add the input, replace `openspecContracts`, delete the hand-written derivation, and confirm its checks still pass.
- [x] 4.3 Confirm neither repository now names the validation commands anywhere.

## 5. Adopt where Nix already runs in continuous integration

- [x] 5.1 `erenshor-data-mining`: add the input and the check, add a `nix flake check` step. Its default branch is protected, so this lands through a pull request.
- [x] 5.2 `HotRepl`: the same, through a pull request. Leave its existing `nix run .#check` step alone.
- [x] 5.3 `test-generalization`: the same. Another agent is working in this repository, so confirm the working tree is clear first. Leave its Lefthook step alone.

## 6. Adopt where the flake exists but Nix is absent from continuous integration

- [x] 6.1 `ancient-kingdoms-mods`: add the input and the check, then add the Nix installer action and a `nix flake check` job following the file's one concern per job style.
- [x] 6.2 `ardenfall-compendium`: run the validations first and report what its 24 unvalidated artifacts produce. If they fail, stop and report rather than landing an input that reddens a protected branch.
- [x] 6.3 Repair what the gate found in `ardenfall-compendium`, so it can be switched on green rather than red.
- [x] 6.4 Adopt in `ardenfall-compendium` once its artifacts pass, through a pull request.

## 7. Bring the two repositories without a flake

- [x] 7.1 `phd-thesis`: add a `flake.nix` exposing only this check. No development shell, no formatter, no change to how the thesis builds.
- [x] 7.2 `phd-thesis`: add the Nix installer action and a `nix flake check` step to its existing workflow.
- [x] 7.3 `renovate-config`: add the same check-only flake.
- [x] 7.4 `renovate-config`: add its first `.github/workflows/` file, running only this check.

## 8. Confirm the end state

- [x] 8.1 Confirm every root holding `openspec/` fails both conditions, by planting each failure once per repository or by reasoning from a shared derivation hash where the input is identical.
- [x] 8.2 Confirm the validation commands appear in exactly one place across all nine repositories.
- [x] 8.3 Confirm no repository declares an OpenSpec CLI dependency of its own, and that all nine resolve the same version through the shared input.
- [x] 8.4 Confirm the two converted repositories lost their hand-written derivations and gained nothing else.

## 9. Close out

- [x] 9.1 Record in this repository's `AGENTS.md` that it defines the fleet's OpenSpec verification, with the command that lists roots holding `openspec/` and whether each consumes the check.
- [x] 9.2 Note the same in `README.md`, beside what it already says about providing the workflow.
- [x] 9.3 Record the sweep for a repository that gains `openspec/` later, since nothing detects that automatically.
