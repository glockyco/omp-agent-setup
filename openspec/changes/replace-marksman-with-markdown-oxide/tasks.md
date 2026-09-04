## 1. Markdown Server Override

- [x] 1.1 Disable the built-in `marksman` server and add the complete `markdown-oxide` definition in `plugin/lsp/lsp.json`, then verify the JSON parses and contains exactly one enabled Markdown server.
- [x] 1.2 Update the plugin package-shape test and README for the new override set, then run the focused plugin-load test and confirm that no executable enters the plugin payload.

## 2. Verification and Release

- [ ] 2.1 With the workstation candidate's fixed-output Markdown Oxide binary, show that the representative Markdown scenario has no server without the override and passes diagnostics, definition, references, and rename with the override.
- [ ] 2.2 Run `nix develop --command bun run ci` and `nix flake check`, then validate `replace-marksman-with-markdown-oxide` strictly.
- [ ] 2.3 Review and commit the complete plugin change, publish the verified revision, and report its commit hash for the workstation pin update.
