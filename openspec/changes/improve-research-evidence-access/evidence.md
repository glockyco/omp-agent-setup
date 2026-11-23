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

The acquisition helper ran for 216 papers. Most full-text reading therefore never passed through it.

## Acquisition helper outcomes

Of 216 attempts, 124 returned a PDF and 92 failed. The counts come from [measure_history.py](measure_history.py), which also reads long batch commands that a first pass had cut off.

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
| No year | 6 | 31 | 40 |

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
| Acquisition helper attempts | 216 | 9 |
| Sessions with five or more scholarly calls that read the skill | 29 of 32 | 9 of 10 |
| OpenAlex calls with a key | 0 | 0 |

The refusing hosts refuse on both hosts. Index calls on the MacBook Pro rarely failed, with 3 failures in 149 calls that touched OpenAlex, and no response there carried the key notice. Its helper commands held an address 3 times, each time the second address. The helper's outcomes by source and year rest on the Windows host alone.

A third host, the MacBook Air, could not be reached and is not included.

## Route checks

Requests from the Windows host on 2026-11-23, without a key and after the keyless OpenAlex budget for the day was spent:

| Request | Result |
|---|---|
| ACM Digital Library article page | HTTP 403 |
| ScienceDirect article page | HTTP 400 |
| ResearchGate publication page | HTTP 403 |
| OpenReview PDF and its API | HTTP 403 |
| IEEE Xplore document page | HTTP 202 without the article |
| OpenAlex record by DOI of an ACM article | HTTP 200, abstract of 200 distinct words |
| OpenAlex record by DOI of an Elsevier article | HTTP 200, abstract of 87 distinct words |
| OpenAlex record by DOI of an IEEE article | HTTP 200, abstract of 119 distinct words |
| Crossref record of the same three DOIs | HTTP 200, abstract for the ACM article only |

The OpenAlex record by DOI therefore serves the abstract for all three publishers, and it answers while searches are refused. The skill names it as the route and Crossref as the fallback for metadata. No scripted route to OpenReview worked, so the skill names the copy elsewhere and the browser relay. The relay route on a publisher page is checked in the trials.

## Keyed OpenAlex check

On 2026-11-23 the key was delivered by `vault file` from the `private` vault and sent as a bearer token built from the delivered file. `/rate-limit` reported a daily budget of $1 with $0.9993 left, 30 requests per second, and prices of $0 for a single record, $0.0001 for a list and $0.001 for a search. A keyed search returned HTTP 200. The same search without the key returned HTTP 429 at the same moment.

## Trials, first round

Fresh subagents on 2026-11-23, one with the released skill and one with the candidate per task. The host had no `UNPAYWALL_EMAIL` and no OpenAlex entry in the vault.

| Task | Released skill | Candidate |
|---|---|---|
| Abstract and full text of a paywalled ACM article | No request to the ACM host. Abstract from OpenAlex after a Crossref lookup. Ran the helper, which refused without the address. Asked which address to use. | No request to the ACM host. Abstract from OpenAlex in one request. Did not run the helper. Asked for the host configuration. |
| Register an arXiv preprint that has a published version | Registered the published version with its DOI after two reads. | Registered the published version with its DOI after the three checks. DBLP answered with an anti-bot challenge. |

- Neither task separates the two skills. The released skill avoided the refusing host and found the published version on its own.
- The preprint was too easy, because its arXiv page names the venue.
- Neither agent used the browser relay after acquisition stopped. The candidate's relay rule covered a helper result only, so it now also covers a helper that cannot run.
- The manuscript trial and the keyed search trial waited for the host variable and the vault entry.

## Trials, second round

Fresh OMP sessions in print mode on 2026-11-23, each started in its own Tern session with `tern new session`, so that they received the host variable set that day. The outcomes were confirmed from the session transcripts and the saved files.

| Task | Released skill | Candidate |
|---|---|---|
| Full text of an IEEE paper from 2023 that is open only as an arXiv manuscript | Looked up Unpaywall itself with an invented address, although the host variable was set. Downloaded the arXiv PDF with `curl`. Did not run the helper and skipped Sci-Hub by its own choice. Asked whether the manuscript is enough. | Ran the helper, which reported `MANUSCRIPT` with exit status 3. Opened the DOI through the browser relay, found a paywall and closed the tab. Asked whether it may use the preprint or will get the published PDF. |
| OpenAlex search with the key | Sent two requests without a key, both refused with HTTP 429. Then found the vault entry, whose delivery needs an interactive approval. Reported the refusal. | Asked the vault first, was refused for the same reason, sent one request without a key, which was refused with HTTP 429, and reported that searches are refused. |
| Repeat of the paywalled ACM article with the widened relay rule and no host variable | Not run. | No scripted request to the ACM host. Abstract from OpenAlex. Did not run the helper and typed no address. Opened the DOI through the browser relay and saved the published PDF of 2,294,901 bytes. |

- The invented Unpaywall address is the one behavior of the released skill that the trials reproduced from the history.
- The relay delivered the published version on the ACM host and met a paywall on the IEEE host.
- A run without an interactive session cannot get the key, because the entry was approved once and not always. The skill now says so.
- The four tasks end alike in three cases. The trials show that the new rules are followed, not that they change outcomes often. The repeated history measurement has to show that.

## Limits

- One person. The corrections, the query classification and the helper outcomes rest on the Windows host.
- A read counts once per call. A script inside `eval` or `bash` can issue many requests in one call.
- Year in key is a proxy for the publication year, and 77 attempts had no year.
- The pairing of a DOI with its result reads the command text and can miss cases, so 10 is a lower bound.
