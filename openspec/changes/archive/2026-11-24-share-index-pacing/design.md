# Design

## Decisions

- The pacing directory is per user, not per machine-wide service, because file locks in the home directory need no daemon. Two machines of the same user still pace separately, which arXiv counts together. That case is rare, and its throttling ends with the exponential backoff.
- A connection lock is held from before the pacing wait until the answer arrives. A lock older than the request timeout plus the longest backoff wait counts as left by a crashed process. A search waits at most ten minutes for another search's open request.
- Spacing stays at four seconds for arXiv, above its three-second rule.

## Verification

- Three processes with separate survey directories and one pacing directory keep the crossref spacing between their requests.
- Two processes searching arXiv with zero spacing against a server that answers in parallel never have two requests open at once. The same test fails when the connection lock is removed.
