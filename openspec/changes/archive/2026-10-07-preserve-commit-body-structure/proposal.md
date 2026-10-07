## Why

Commit bodies currently collapse every line within a blank-line-delimited paragraph into prose. Lists immediately following prose lose their item boundaries, and code and Git trailers lose meaningful whitespace or line structure.

## What Changes

- Reflow ordinary prose at 72 columns while keeping paragraph separation and indivisible tokens intact.
- Recognize bullet and ordered list items without requiring a preceding blank line; wrap their text with a hanging indent and preserve nested marker indentation.
- Preserve fenced code and non-marker lines indented by four spaces or a tab verbatim.
- Preserve a final paragraph consisting entirely of Git trailers line by line.
- Add executable formatting regressions without changing subject validation or Git transport.

## Capabilities

### New Capabilities

### Modified Capabilities

- `structured-commit`: extend stable message formatting to preserve lists, code blocks, and final trailer paragraphs.

## Impact

- `plugin/extensions/personal-commit.ts`: body block recognition and wrapping only.
- `plugin/tests/personal-commit.test.ts`: observable formatting coverage.
- The existing commit policy and tool field descriptions make no inaccurate wrapping claims and need no change.
- No dependencies, generated OpenSpec adapters, staging, push behavior, or other extensions change.
