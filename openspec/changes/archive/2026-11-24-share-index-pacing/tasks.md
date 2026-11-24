# Tasks

## 1. Pacing

- [x] 1.1 Move pacing state to a per-user directory and keep log and corpus locks in the survey directory. Verify with a test of three processes in separate survey directories.
- [x] 1.2 Hold a connection lock per request for arXiv, Semantic Scholar and OpenAlex semantic search. Verify with a test that fails without the lock.

## 2. Release preparation

- [x] 2.1 Raise the versions to the next patch version. Verify with the release-version check.
- [x] 2.2 Run strict validation and `bun run check:local`. Verify that both pass.
