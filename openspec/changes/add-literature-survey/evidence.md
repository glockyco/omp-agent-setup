# Evidence

## Source and method

The source and the method are those of [the access change](../improve-research-evidence-access/evidence.md): the OMP session transcripts of one Windows host from 2026-09-03 to 2026-11-23. This file adds the numbers on how works were found. The transcripts cover private work, so it holds counts only.

## How searches ran

The history has 2,193 web searches with 2,069 distinct queries. A small model classified a random sample of 330 queries:

| Kind of query | Share | Estimated calls |
|---|---|---|
| Lookup of a known work | 43% | 950 |
| Not about literature | 30% | 665 |
| Search of a topic | 17% | 360 |
| Venue or deadline | 10% | 225 |

Index calls through `read`, `eval` and `bash`, counted per call:

| Kind of call | Calls | Sessions |
|---|---|---|
| OpenAlex keyword search | 175 | 19 |
| OpenAlex lookup by identifier | 145 | 19 |
| Crossref lookup by DOI | 225 | 22 |
| Crossref query | 113 | 15 |
| DBLP publication search | 151 | 17 |
| arXiv API search | 43 | 7 |
| OpenAlex citing works | 18 | 4 |
| Semantic Scholar search | 4 | 3 |

- Of 183 OpenAlex keyword searches by URL, 74 asked for 5 results or fewer and one asked for more than 50. They are lookups and first pages, not harvests.
- Works cited by a paper were never requested from an index.
- About 155 `eval` and `bash` calls carried hand-written code that queried an index.

## Failures under parallel use

Share of calls that touched an index and failed:

| Index | September | October | 1 to 18 November | 19 to 23 November |
|---|---|---|---|---|
| OpenAlex | 22 of 175 | 7 of 124 | 9 of 29 | 22 of 60 |
| Crossref | 16 of 145 | 24 of 262 | 9 of 43 | 7 of 20 |
| DBLP | 3 of 72 | 8 of 65 | 11 of 32 | 3 of 7 |
| arXiv search and API | 1 of 54 | 2 of 31 | 0 of 10 | 29 of 55 |

The last period held two surveys in which several subagents queried the indexes at once.

## The paced search tool of 2026-11-23

During the second survey the main agent defined one search tool for all subagents. It spaced requests per index, retried a throttled request, stopped using an index for ten minutes after a refusal, cached repeated queries and appended every query to a log.

- The log holds 406 queries from 11 subagents and the main agent in 58 minutes. 369 were answered, 31 came from the cache and 6 timed out.
- arXiv answered 145 queries with a median of 11 total hits. In 32% of them the index held more hits than were returned.
- Crossref answered 224 queries with a median of about one million total hits, because it matches loosely. The agents saw the first 25.
- OpenAlex, Semantic Scholar and DBLP refused their first request and were not used.
- The tool lived in the session's kernel and ended with it.

## Which channel showed the cited works

Ten of the twelve reports of that survey cite 298 works by arXiv identifier or DOI. For each work, the transcripts show which results displayed it to the agent:

| Shown by | Works | Share |
|---|---|---|
| Web search only | 99 | 33% |
| Index query only | 56 | 19% |
| Both | 26 | 9% |
| Given in the task or an earlier report | 75 | 25% |
| A page of another work | 35 | 12% |
| Named by the agent before any result | 7 | 2% |

Web search showed 125 of the cited works and index queries 82. Among the 181 works that a search channel showed, 14% came from both. All ten agents searched the web first.

## What the session did that the skill does not describe

- It harvested 489 preprint records with abstracts into one file before screening.
- Its reports have fixed sections for how the search was done, what was not found, the query log and how much of each work was read.
- Its summary says that a gap means these queries did not find a work, and it lists five of its own earlier conclusions that the survey overturned. A survey four days earlier overturned three more.

## Triggering and screening

- The skill was read in 29 of 32 sessions with at least five scholarly calls, and in 112 of 117 such subagent transcripts.
- In one session, ten source notes were written over three days before the skill was first read.
- The skill's second step says to screen titles first and to read abstracts for the survivors. The person called screening by title inadequate and set title and abstract as the minimum.
- The classified corrections on the reach of a search number 19 in September, 1 in October and 7 in November. Those on screening depth number 4, 1 and 2.

## Trials of 2026-11-23

Five canary questions ran with fresh agents, each with the released plugin 0.11.17 and with the candidate, 21 runs in all. The questions and their canary works stay outside this repository. Each question has between one and three canary works, nine in total. A sixth question was collected but not run.

| Question | Canaries | Released plugin | Candidate |
|---|---|---|---|
| 1 | 2 | one canary in 2 of 3 runs | one canary in 1 of 5 runs |
| 2 | 3 | 1 | 2, in 2 of 2 runs |
| 3 | 3 | 0 | 1, in 2 of 2 runs |
| 4 | 1 | 0 | 1, in 3 of 3 runs |
| 5 | 2 | 2 | 2, in 2 of 2 runs |

- The pass rule of the design fails on question 1. The released plugin found that canary in web-search snippets, and candidate agents made one or two web searches.
- The candidate changed three times between rounds. The helper crashed when its output went to a pipe on Windows. Agents searched one wording of the subject. In 5 of the first 8 candidate runs the agents screened only part of the corpus, and in one of them a canary sat unscreened in it. After the `unscreened` mode and the rule to screen every record, all 6 candidate runs screened the whole corpus.
- Screening reasons stayed templated. One run decided with a keyword script. The 2 runs after the rule against both still gave 12 to 14 distinct reasons per 100 records.
- Agents ended after 2 to 5 of the 15 minutes they were given, so the trials measure a short survey.
- The two reference-set reruns did not run, because the approved budget of about 20 runs was used up.

## Limits

- The channel attribution covers one day, one subject area and works cited with an identifier. OpenAlex took no part in it.
- An agent that sees a work in a web result may not look for it in an index, so the index share is a lower bound.
- The query classification rests on a sample and a small model.
