## Why

OMP's built-in Markdown server is Marksman, but the current official Linux binary crashes before command parsing and the last working binary predates current Markdown behavior. Markdown Oxide provides the required Markdown intelligence through current official binaries, so the personal plugin must select it explicitly before the workstation can remove Marksman.

## What Changes

- Disable OMP's built-in `marksman` server in the personal LSP overrides.
- Define `markdown-oxide` as the primary server for `.md` and `.markdown` files.
- Preserve Markdown diagnostics, definition, references, and rename behavior.
- Keep language-server installation in the workstation repository; this plugin contains configuration only.
- Remove the claim that the plugin overrides only Roslyn and Svelte.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `personal-omp-plugin`: Select Markdown Oxide as the sole primary Markdown server and disable the built-in Marksman definition.

## Impact

- Affects `plugin/lsp/lsp.json`, its package-shape check, and plugin documentation.
- Requires a verified plugin release before `glockyco/nix-config` advances its pin and replaces the packaged executable.
- Does not install a language server, mutate OMP configuration, or change non-Markdown language behavior.
