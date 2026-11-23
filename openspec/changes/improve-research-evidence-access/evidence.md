# Evidence

## Source and method

The numbers come from the OMP session transcripts of one Windows host, from 2026-09-03 to 2026-11-23: 1,297 transcript files, 1,099 of them from subagents, with 141,042 tool calls. No call went to an MCP server.

A script read every tool call and its result. It classified each URL by host and purpose, and it counted a read as refused when the result reported an HTTP error or held less than 400 characters with a refusal marker. A small model classified user messages that mention literature work. That classification is approximate.

The transcripts cover private work, so this file holds counts only.

## Hosts that refuse scripted requests

Single-URL reads through the `read` tool:

| Host | Reads | Refused or empty |
|---|---|---|
| ACM Digital Library | 122 | 112 refused with HTTP 403 |
| ScienceDirect | 36 | 35 refused with HTTP 403 |
| ResearchGate | 14 | 8 refused with HTTP 403 |
| Google Scholar | 1 | 1 refused |
| OpenReview pages | 32 | 31 returned under 1,500 characters |
| IEEE Xplore | 34 | 12 returned under 1,500 characters |

ACM Digital Library reads by month were 35, 41 and 46. Subagents made 117 of the 122, across 59 transcripts. Each new subagent repeated the attempt.

Semantic Scholar received 4 search calls and about 38 lookups, mostly for an open-access PDF link. Between 18% and 50% of its calls per month failed with HTTP 429. It refused a single request on 2026-11-23.

## Where full text was read

| Surface | Reads | Median size in characters |
|---|---|---|
| arXiv HTML | 648 | 37,441 |
| arXiv abstract pages | 291 | not measured |
| ACL Anthology | 150 | 17,717 |
| Springer | 85 | 21,955 |

The acquisition helper ran for 185 papers in 8 sessions. Most full-text reading therefore never passed through it.

## Acquisition helper outcomes

Of 185 attempts, 124 returned a PDF and 61 failed.

| Source of the PDF | Count |
|---|---|
| Sci-Hub | 59 |
| arXiv | 46 |
| Open-access repository | 13 |
| Publisher, open access | 6 |

By the year in the citation key:

| Year in key | Sci-Hub | Other sources | Failed |
|---|---|---|---|
| Before 2022 | 52 | 9 | 36 |
| 2022 or later | 1 | 25 | 16 |
| No year | 6 | 31 | 9 |

For works from 2022 on, the published version came from neither Sci-Hub nor an open publisher copy in all but one case. It is reachable only through the browser session or the person.

When the command passed a publisher DOI, 61 results were the version of record and at least 10 were manuscripts. The helper reported those 10 as ordinary successes.

The helper swallows every Unpaywall error. A failed lookup and a work without an open-access copy produce the same message.

## Identity and keys

- `UNPAYWALL_EMAIL` was not set in the host environment. Agents typed an address into 76 helper commands, 4 of them with a second address of the same person, and 23 commands had none.
- Every OpenAlex response since 2026-10-15 has carried a notice that requests without a key share a daily budget of $0.10 per network address and that a free key has $1 a day. Agents saw it in 48 responses. No call passed a key.
- Calls that touched OpenAlex failed in 22 of 175 cases in September, 7 of 124 in October, 9 of 29 from 1 to 18 November and 22 of 60 from 19 to 23 November.
- On 2026-11-23 a keyless search returned HTTP 429 with the daily budget spent and a retry time of 9.5 hours.
- OpenAlex documents that a personal key is also the sign-in credential of the account, that it is sent as an `api_key` parameter or as a bearer token, and that single-record lookups cost nothing.

## Corrections by the person

The classified user messages contain 88 corrections of literature work. By month, from September to November:

| Aspect | September | October | November |
|---|---|---|---|
| Coverage of the search | 19 | 1 | 7 |
| Unsupported or misread claim | 11 | 6 | 2 |
| Reporting | 8 | 6 | 7 |
| Metadata | 6 | 4 | 0 |
| Screening depth | 4 | 1 | 2 |
| Access to full text | 3 | 1 | 0 |

Standing instructions in those messages: full texts are required for key papers, a preprint must not be used when a published version exists without asking first, and arXiv entries of published papers are to be replaced by the published version.

The person handed over PDFs by hand in 9 sessions. Agents drove a browser tab on a publisher page in 11 sessions.

## Second host

A rerunnable script repeated the counts on the MacBook Pro, whose history runs from 2026-08-07 to 2026-11-23 with 3,378 transcript files and 604,089 tool calls. No call went to an MCP server there either. Literature work on that host is a small part of this:

| Count | Windows host | MacBook Pro |
|---|---|---|
| ACM Digital Library reads, refused | 112 of 122 | 32 of 36 |
| ScienceDirect reads, refused | 35 of 36 | 4 of 4 |
| ResearchGate reads, refused | 8 of 14 | 4 of 4 |
| OpenReview pages under 1,500 characters | 31 of 32 | 3 of 3 |
| arXiv HTML reads | 648 | 61 |
| Acquisition helper attempts | 185 | 9 |
| Sessions with five or more scholarly calls that read the skill | 29 of 32 | 9 of 10 |
| OpenAlex calls with a key | 0 | 0 |

The refusing hosts refuse on both hosts. Index calls on the MacBook Pro rarely failed, with 3 failures in 149 calls that touched OpenAlex, and no response there carried the key notice. Its helper commands held an address 3 times, each time the second address. The helper's outcomes by source and year rest on the Windows host alone.

A third host, the MacBook Air, could not be reached and is not included.

## Limits

- One person. The corrections, the query classification and the helper outcomes rest on the Windows host.
- A read counts once per call. A script inside `eval` or `bash` can issue many requests in one call.
- Year in key is a proxy for the publication year, and 46 attempts had no year.
- The pairing of a DOI with its result reads the command text and can miss cases, so 10 is a lower bound.
