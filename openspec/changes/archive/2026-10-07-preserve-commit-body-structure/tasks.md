## 1. Body formatting

- [x] 1.1 Implement line-aware prose, list, code, and final-trailer formatting in `personal-commit.ts`, preserving leading code indentation and wrapping budgets; verify through observable formatter tests.
- [x] 1.2 Add regression tests for the exact reader example, hanging indents, multi-digit numbered and nested lists, fenced and indented code, trailers, unchanged prose reflow and paragraph separation; verify with the Bun behavior suite.

## 2. Verification

- [x] 2.1 Validate this change with `openspec validate preserve-commit-body-structure --strict`, run both `nix develop --command bun run ci` and `nix flake check`, and report any unrelated gate failure with its output.
- [x] 2.2 Run a throwaway Bun script printing `formatCommitMessage` for the exact reader example, delete the script, and report the output and unperformed release steps.
