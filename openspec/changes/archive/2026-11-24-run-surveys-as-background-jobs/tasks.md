# Tasks

## 1. Survey program

- [x] 1.1 Add a gateway-backed `completion` that talks to `omp auth-gateway stdio`. Verify with a test against a fake gateway process.
- [x] 1.2 Add the `run` and `add` commands, printing each step to standard output. Verify with a test that runs the command with a fake gateway and fixture indexes.
- [x] 1.3 Write `status.json`, the registry entry and honour the `stop` file. Verify with tests for each.

## 2. Skill

- [x] 2.1 Describe the background run with `notify`, the item folder, the check for earlier surveys and `tern open --preview`. Verify by reading the skill against the spec.

## 3. Tern plugin

- [x] 3.1 Write `tern/research-surveys/` with the host widget, the buttons and the window toasts. Verify by loading it with `tern plugin link` and watching a live survey.

## 4. Release preparation

- [x] 4.1 Raise the versions to 0.14.0. Verify with the release-version check.
- [x] 4.2 Run strict validation and `bun run check:local`. Verify that both pass.
