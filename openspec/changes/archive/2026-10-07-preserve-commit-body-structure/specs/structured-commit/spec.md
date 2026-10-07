## MODIFIED Requirements

### Requirement: Stable message formatting

The tool SHALL preserve paragraph boundaries, wrap ordinary prose to 72 columns, and SHALL NOT split URLs, code tokens, or other indivisible long tokens. Blank-line paragraph separation SHALL remain unchanged.

A line beginning with `- `, `* `, `+ `, or a decimal ordered marker followed by `. ` or `) ` SHALL start a new list item, including multi-digit markers and markers with leading indentation. A preceding blank line SHALL NOT be required: prose before the first item SHALL remain a separate prose block. Each item SHALL wrap to 72 columns with a hanging indent aligned to the text after its marker, and nested markers SHALL retain their leading indentation. Following indented non-marker lines below the code indentation threshold SHALL continue the current item. A blank line or an unindented non-marker line SHALL end the item; unindented prose following a list SHALL form a separate prose block even without a blank line.

Fenced code blocks delimited by backticks, including internal blank lines, and non-marker lines indented by at least four spaces or a tab SHALL be emitted verbatim. The final paragraph, when every line is a Git trailer of the form `Token: value`, `Token #value`, or `BREAKING CHANGE: ...`, SHALL be emitted line by line without reflow.

#### Scenario: Format multiple paragraphs

- **WHEN** the body contains two paragraphs and an overlong URL
- **THEN** ordinary words wrap, the blank line remains, and the URL remains intact

#### Scenario: List directly follows prose

- **WHEN** prose ending in `The reader:` is immediately followed by bullet items
- **THEN** the prose remains separate and every marker begins a separate item

#### Scenario: Wrap bullet and ordered items

- **WHEN** a body contains long bullet items and numbered items including `10.` and `10)`
- **THEN** the items wrap at 72 columns with continuation lines aligned after their respective markers
- **AND** indivisible long tokens remain unbroken

#### Scenario: Preserve nested item indentation

- **WHEN** a body contains nested items with leading indentation
- **THEN** the markers retain that indentation and wrapped lines align with the item text

#### Scenario: Distinguish item continuation from following prose

- **WHEN** an item has a two-space-indented continuation followed immediately by unindented prose
- **THEN** the indented line is reflowed with its item and the unindented prose starts a separate block

#### Scenario: Preserve code blocks

- **WHEN** a body contains fenced code with blank lines or non-marker lines indented by four spaces or a tab
- **THEN** those lines retain their indentation, spacing, line boundaries, and overlong text

#### Scenario: Preserve final Git trailers

- **WHEN** the final paragraph contains only `Token: value`, `Token #value`, and `BREAKING CHANGE: ...` trailer lines
- **THEN** every trailer remains on its original line without wrapping
