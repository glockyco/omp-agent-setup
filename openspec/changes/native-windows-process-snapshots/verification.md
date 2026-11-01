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
