## 1. Unify the toolchain

- [x] 1.1 Remove `.bun-version` and the separate Bun setup action
- [x] 1.2 Run dependency installation and Bun CI through `nix develop`
- [x] 1.3 Add a flake check that proves the runtime Bun version

## 2. Automate flake updates

- [x] 2.1 Add a weekly and manually dispatchable flake-lock workflow
- [x] 2.2 Mint and pass a short-lived GitHub App installation token
- [x] 2.3 Configure a stable review-only update pull-request branch
- [x] 2.4 Disable Renovate's Nix manager explicitly

## 3. Gate generated artifacts

- [x] 3.1 Add the locked OpenSpec package to the development shell
- [x] 3.2 Add a pure generated-adapter freshness check
- [x] 3.3 Reject incomplete archived OpenSpec changes
- [x] 3.4 Verify package-shape and extension checks remain intact

## 4. Document operations

- [x] 4.1 Add concise repository guidance and dependency ownership
- [x] 4.2 Document manual updates, release gates, and downstream smoke
- [x] 4.3 Link automation files to the canonical operating procedure

## 5. Verify repository behavior

- [x] 5.1 Run formatting, lint, types, dead-code, audit, tests, and coverage
- [x] 5.2 Run supported Darwin and Linux flake checks
- [x] 5.3 Create and install the least-privilege updater GitHub App
- [x] 5.4 Store the App client ID and private key as Actions configuration
- [x] 5.5 Correct required status contexts and enforce protection for administrators
- [x] 5.6 Prove a generated update pull request starts both CI jobs and cannot merge when one fails

## 6. Complete the change

- [x] 6.1 Validate the OpenSpec change strictly
- [x] 6.2 Publish the reviewed implementation through a pull request
- [x] 6.3 Archive and validate the completed OpenSpec change
