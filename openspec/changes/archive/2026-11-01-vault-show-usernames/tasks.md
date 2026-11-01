# Tasks

## 1. Vault tool

- [x] 1.1 Show usernames and URIs in search results, and stop registering usernames for redaction, also when reloading earlier deliveries.
- [x] 1.2 Update the tool description and the unit tests, including a test that a delivered username stays readable.
- [x] 1.3 Raise the version to 0.11.8 in `.omp-plugin/marketplace.json`, `plugin/package.json` and `package.json`. Verify that `bun run check:local` passes and that the change validates.

## 2. Release

- [x] 2.1 Obtain the three native CI contexts and the OpenSpec context on the pull request, merge and tag `v0.11.8`.
- [x] 2.2 Upgrade the Mac and Korolev. Verify in a fresh OMP session on each host that a vault search shows usernames.

## Workflow follow-up

- Archive the change after both hosts run the release.
