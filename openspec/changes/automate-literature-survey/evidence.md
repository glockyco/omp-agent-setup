# Evidence

The canary questions and their works stay outside this repository. This file holds counts.

## Channels on the canary questions

Five questions with eleven canary works, the data of the 0.12.0 trials.

| Channel | Canaries among the candidates | Cost |
|---|---|---|
| Keyword searches of all 14 candidate trial runs together, about 160 queries | 7 of 11 | $0.25 to $0.45 per agent run |
| One OpenAlex semantic search with the question as asked | 6 of 11 | $0.001 |
| That search, plus one citation hop and semantic searches seeded with the top hits, no model | 9 of 11 | about $0.05 |

## Screening on one question

| Step | Result |
|---|---|
| Candidates from agent keyword searches, semantic search and citing works | 1,529 records |
| Records that a small model judged to meet all three criteria the model derived from the question | 23, both canaries among them, 15 minutes, $0.15 |
| Of 22 such works available to the trial agents, named in their reports | between 1 and 6 per report |
| The agents' own queries run through semantic search, 700 new records screened | 14 more works meeting all criteria |
| Works meeting all criteria found by keyword search, by semantic search, by both | 19, 24, 9 |

Two channels that overlap in 9 works suggest about 51 such works (Lincoln-Petersen estimate), against 36 found by all channels together.

## Benchmark of the program

Exhaustive runs on the five canary questions, five in parallel, with the Semantic Scholar full-text channel.

| Question | Canaries | Core | Related | Missed | Records | Core works per round |
|---|---|---|---|---|---|---|
| 1 | 2 | 2 | 0 | 0 | 2,751 | 27, 21, 18 |
| 2 | 3 | 2 | 1 | 0 | 3,078 | 382, 93, 90 |
| 3 | 3 | 0 | 1 | 2 | 2,923 | 132, 27, 32, 32 |
| 4 | 1 | 1 | 0 | 0 | 1,478 | 34, 8 |
| 5 | 2 | 2 | 0 | 0 | 3,051 | 69, 5, 23, 22 |

- 9 of 11 canaries reached the kept set, 7 of them as core. The two misses are the works framed differently from the question, which no channel found in the earlier measurement either.
- No run saturated. Four ended on the budget of 2,500 screened records after about 30 minutes, with rounds still adding 18 to 90 core works. On broad questions the program reports an incomplete search rather than reaching saturation.
- One run stopped when OpenAlex refused requests while five surveys ran at once. Pacing is per survey directory, so parallel surveys share no pacing.
- An overview of question 1 took 8 minutes and had both canaries as core works after the first round.
- Before the first expansion rounds were capped at 300 records ordered by links to core works, a single expansion round took over 20 minutes.

## Trials and speed

- Three fresh agents got the candidate skill and a request that named no depth. Each chose a fitting depth: overview for a rough overview and for a related-work list, exhaustive for a novelty claim. The novelty search saturated, and the agent refuted the claim with five works it had read.
- The overview trial's survey took 24 minutes, mostly screening one record per model call. Screening twenty records per call took 8 seconds for 200 records and agreed with per-record screening on 189 of 200 core decisions. With concurrent expansion, an overview of a new question took 84 seconds.
- The overview benchmark with the faster screening kept 8 of the 11 canaries, 7 as core works. It missed Policy2Code, which the exhaustive run had found through Semantic Scholar full text, which overviews skip. A rerun bug let these overviews run one round more than their limit, so the numbers come from slightly deeper searches.
- The exhaustive benchmark with the faster screening did not finish. After a day of benchmark runs, arXiv answered every request from this address with HTTP 429. The exhaustive numbers above come from per-record screening.

## Other systems and studies

- Ai2 Paper Finder and Undermind run fixed pipelines with model relevance judgments, citation tracking and rounds. Their published evaluations are their own. Undermind estimates completeness from a discovery curve and a comparison with Google Scholar that assumes independence.
- An independent evaluation of Elicit found a sensitivity of 39.5% against 94.5% for professional searches.
- LitSearch: dense retrieval beats keyword retrieval by 24.8 points recall@5. ScholarCatalyst: search agents do no better than the retriever they call.
- Ai2's novelty-judge study: model verdicts on novelty shift by up to 50 points with small prompt changes.
- Software engineering review methodology recommends database search combined with backward and forward snowballing.
- A meta-analysis of model screening reports pooled sensitivity 0.81, and recall-tuned setups reach 0.95 to 1.0.

The sources are listed in `survey-tooling-options-2026-11-23.md` outside this repository.
