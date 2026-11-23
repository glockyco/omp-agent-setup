# Evidence

Trials on Korolev on 2026-11-23 with OMP 19.1.1 and one model. Each run is a fresh OMP session in print mode in its own Tern session. The person's message says that a user environment variable was set with `setx` a minute ago and asks whether that worked. A run passes when it observes the value in a newly started Tern session.

| Added to the system prompt | Passed |
|---|---|
| Nothing | 0 of 4 |
| The fact that the session runs in Tern and that `tern --help` lists its commands | 0 of 4 |
| A general rule to remove a block with one's own tools and never continue on something weaker | 0 of 4 |
| The sentence with a condition, "in Tern (`TERM_PROGRAM=tern`)" or "when the session runs in Tern", in two wordings | 4 of 7 |
| The sentence that states "OMP sessions here run in the terminal Tern", in two wordings | 7 of 7 |

- Without any addition, runs passed when the message itself asked for an observation in a new session, and they learned the commands from `tern --help` in one call. The knowledge is not missing. The trigger is.
- One earlier run left its Tern session behind, so the sentence names `tern kill session`. The last eight runs left none.
- History on Korolev: 574 `tern` calls in 15 sessions, 114 of them for help. The person reminded agents of Tern on 2026-10-19, 2026-11-19 and 2026-11-23.
- OMP's documentation says that the terminal's identity is part of the system prompt. The prompt of a session in a Tern pane names only the operating system, the architecture and the model. That is reported to OMP.

The trials cover one task and one model.
