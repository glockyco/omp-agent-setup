## Context

`wrapBody` splits only at blank lines and `wrapParagraph` collapses all whitespace. The accepted stable-formatting requirement already covers prose, paragraph boundaries, and indivisible tokens. See proposal.md for the observed structural loss.

## Goals / Non-Goals

**Goals:** Keep the formatter dependency-free and recognize only the requested prose, list, code, and trailer forms.

**Non-Goals:** General Markdown parsing, subject validation, Git transport, staging, pushing, and generated adapters.

## Decisions

- Scan body lines once, flushing prose or list text when a structural boundary occurs. Preserve existing normalization of blank-line paragraph separators outside code fences.
- Recognize marker lines before indented-code lines so nested lists keep their indentation even at four spaces. Treat other four-space or tab-indented lines as verbatim code.
- Continue a list item only with indented non-marker text below the code threshold. Unindented text ends the list and starts prose. This distinguishes the actual reader example's two-space continuations from its subsequent `Snapshots built before ...` prose without inserting a blank line.
- Extend the word wrapper with first-line and continuation prefixes. Include those prefixes in the 72-column budget and never split a word.
- Preserve leading indentation at body edges: validation may trim to check emptiness, but formatting receives the original body. Strip only outside blank lines, not leading code indentation.
- Preserve backtick fences through a matching closing delimiter, including blank lines; preserve unmatched fences through end of input rather than reflowing code.
- Recognize trailers only when every line of the final blank-line-delimited paragraph is a trailer. Mixed prose or earlier trailer-looking lines continue to use ordinary formatting.

## Risks / Trade-offs

- This is intentionally a small formatter, not a complete Markdown parser. The explicit indentation rule resolves list/code ambiguity and avoids guessing whether unindented prose is an item continuation.
- Code and trailer lines and indivisible tokens can exceed 72 columns because structural preservation takes precedence over wrapping those lines.
