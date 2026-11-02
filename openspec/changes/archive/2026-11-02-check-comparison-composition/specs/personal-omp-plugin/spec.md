## MODIFIED Requirements

### Requirement: Options shown in place

The `compare-options` skill SHALL have the agent keep a comparison to what its decision needs, show each option in place with screenshots of the real page at the same widths, including a phone width and every width where the layout changes, and look at every screenshot for layout defects before showing it.

#### Scenario: Stray line break

- **WHEN** a screenshot shows a line that wraps although the layout has room for it
- **THEN** the skill directs the agent to fix or point out the break before it opens the comparison

#### Scenario: A layout that changes with the width

- **WHEN** an option's layout changes between a desktop and a phone width
- **THEN** the skill directs the agent to show screenshots at a phone width and at each width where the layout changes

## ADDED Requirements

### Requirement: Composition checked before showing

The `compare-options` skill SHALL have the agent check the composition of every screenshot before showing it: repeated items share one size, edges line up with the column or panel around them, and the layout holds at each width where it changes.

#### Scenario: Repeated items of different sizes

- **WHEN** a screenshot shows cards of one kind in a row with different widths
- **THEN** the skill directs the agent to fix or point out the difference before it opens the comparison
