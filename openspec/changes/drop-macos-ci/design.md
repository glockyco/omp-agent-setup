# Design

## Decisions

- Linux covers the POSIX behavior that macOS shares with it, and Windows covers the remaining platform differences, such as paths, processes and terminals.
- The release gate keeps its macOS support, so it can still run on the Mac when a change touches process or terminal handling there.

## Risks

- A regression that only macOS shows reaches the Mac through its hourly plugin upgrade. Releases are installed on the Mac right after publication, which shows such a regression early.
