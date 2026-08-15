## 1. Central Control Plane

- [x] 1.1 Register `omp-agent-setup` with a complete flake update command and `flake.lock` allowlist
- [ ] 1.2 Configure the central App credential and protect the controller main branch
- [ ] 1.3 Run one targeted update and verify App authorship plus normal Darwin and Linux CI

## 2. Target Cutover

- [x] 2.1 Remove the target-local Nix update workflow
- [x] 2.2 Update target guidance and dependency ownership validation
- [ ] 2.3 Delete the target App variable and secret after the central run succeeds
- [ ] 2.4 Close the obsolete updater pull request and delete its branch

## 3. Verification

- [ ] 3.1 Run plugin tests, flake checks, and strict OpenSpec validation
- [ ] 3.2 Verify required branch protection through the GitHub API
- [ ] 3.3 Archive this change after repository state matches every requirement
