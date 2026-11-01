# Verification

## Before

Timings come from GitHub Actions job timestamps and timestamped `gh run view <run> --log` output. Each part runs from its command line to the next command line. Installed-release ends at the cleanup step. All three runs succeeded.

| Run | Windows job seconds | Native gate seconds | Installed-release seconds |
| --- | ---: | ---: | ---: |
| [41314625055](https://github.com/glockyco/omp-agent-setup/actions/runs/41314625055) | 493 | 443.778 | 399.325 |
| [41313770664](https://github.com/glockyco/omp-agent-setup/actions/runs/41313770664) | 466 | 417.151 | 373.902 |
| [41313188794](https://github.com/glockyco/omp-agent-setup/actions/runs/41313188794) | 407 | 350.875 | 305.019 |

| Native gate part | Run 41314625055 seconds | Run 41313770664 seconds | Run 41313188794 seconds |
| --- | ---: | ---: | ---: |
| Toolchain | 0.036 | 0.036 | 0.027 |
| Lint | 0.241 | 0.240 | 0.185 |
| Types | 0.341 | 0.325 | 0.240 |
| Dead code | 1.234 | 1.243 | 1.045 |
| Release | 0.269 | 0.264 | 0.204 |
| Tests | 40.202 | 39.029 | 41.153 |
| Adapters | 0.679 | 0.681 | 0.494 |
| OpenSpec | 1.333 | 1.348 | 2.400 |
| Audit | 0.118 | 0.083 | 0.108 |
| Installed release | 399.325 | 373.902 | 305.019 |

The installed-release gate accounts for most of the Windows job. Its ownership helper starts PowerShell and enumerates all CIM processes for every initial identity, descendant poll, survivor check and termination check. The replacement keeps those ownership checks and removes their shell startup. No test selector, coverage configuration, test scenario, settling interval or timeout is removed or relaxed.

## After

Three successful Windows runs used the same candidate revision. Attempts 2 and 3 reran only the Windows job, each on a fresh hosted runner. The other required contexts remained successful from attempt 1.

| Run attempt | Windows job seconds | Native gate seconds | Installed-release seconds |
| --- | ---: | ---: | ---: |
| [1](https://github.com/glockyco/omp-agent-setup/actions/runs/41316741639/job/124878278300) | 387 | 338.180 | 284.260 |
| [2](https://github.com/glockyco/omp-agent-setup/actions/runs/41316741639/job/124880263443) | 373 | 324.068 | 269.353 |
| [3](https://github.com/glockyco/omp-agent-setup/actions/runs/41316741639/job/124881840704) | 423 | 372.000 | 317.118 |

| Native gate part | Attempt 1 seconds | Attempt 2 seconds | Attempt 3 seconds |
| --- | ---: | ---: | ---: |
| Toolchain | 0.036 | 0.042 | 0.036 |
| Lint | 0.241 | 0.250 | 0.255 |
| Types | 0.303 | 0.328 | 0.322 |
| Dead code | 1.315 | 1.308 | 1.210 |
| Release | 0.292 | 0.291 | 0.276 |
| Tests | 47.784 | 48.455 | 48.663 |
| Adapters | 0.656 | 0.667 | 0.694 |
| OpenSpec | 3.166 | 3.233 | 3.299 |
| Audit | 0.127 | 0.141 | 0.127 |
| Installed release | 284.260 | 269.353 | 317.118 |

Mean Windows job time fell from 455.333 to 394.333 seconds, a 61-second or 13.4% reduction. Mean installed-release time fell from 359.415 to 290.244 seconds, a 19.2% reduction. These are observed hosted-runner timings, not a statistical performance guarantee.

All three candidate runs passed the same 25 installed-release scenarios. The candidate passed all 212 Bun tests. Windows coverage remained 97.62% of functions and 92.72% of lines, identical to all three baseline runs, with the existing per-file floor unchanged. New Python controls verify cache invalidation, denied or failed snapshots and the actual Windows query without a subprocess. Existing orphan-descendant, unrelated-session, PID-reuse and termination-error controls remain in the installed-cache Python discovery.

## Local verification

Toolchain, lint, types, dead code, release-version, all 212 Bun tests with coverage, adapters, strict active/archive/prospective OpenSpec and audit passed. The first installed-release launch stopped because a locally selected prerelease Python did not match the gate. After selecting stable Python, 24 of 25 release scenarios passed, including installed-cache Bun/Python behavior. The full-LSP scenario timed out waiting for markdown-oxide while the official OMP terminal displayed setup. The complete native gates passed on every CI platform without changing that assertion or deadline.
