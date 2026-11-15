# FINN — build history and AI collaboration

This document explains how I approached the build: the product decisions I made, the engineering problems I encountered, where I changed direction, and how I used AI tools during implementation.

The accompanying archive contains the raw Claude Code sessions. The product-design conversation is shared separately. This document is an index and narrative, not a substitute for those original records.

## How I used AI tools

I used two workflows for different kinds of work:

- **Claude.ai** helped me challenge the product thesis, explore interaction models, and decide what to prioritise or leave out.
- **Claude Code** helped implement and iterate on the application, worker pipelines, tests and documentation.

I treated the tools as collaborators that could accelerate implementation and expose alternatives, not as authorities. I set the product direction, chose the architecture, reviewed the code and output, and checked important claims against the running application or source. When an implementation or generated explanation was wrong, I corrected it.

The most useful pattern was iterative: define the constraint, ask for an implementation or critique, inspect the result, test it, and revise the decision if the evidence warranted it.

## 1. Starting with the product thesis

The challenge described information overload as the problem and filtering as the scarce skill. I reframed the requirement as **filtering that investors can trust**.

That led to three early decisions:

1. **Build a triage workflow, not another chronological feed.** The core interaction became Needs you / Worth knowing / Routine.
2. **Keep routine information available without giving it equal visual weight.** Routine items are collapsed, not deleted.
3. **Make promised-versus-delivered the central research workflow.** Rather than attempting every possible financial-analysis section, I focused on management commitments and whether later evidence supports them.

The research concept that became FINN's signature is **quietly dropped guidance**: a target that management stated and later stopped discussing. I wanted to surface this carefully, with explicit conditions, rather than treat every missing mention as proof that a target had been abandoned.

## 2. Learning the data sources before designing around them

The first engineering work was to test the external sources and understand their failure modes.

- BSE's public endpoints did not behave like a generic JSON API. Plain HTTP requests could be rejected by Akamai, and responses could occasionally be empty. I used the BSE package, request pacing and retries rather than assuming a simple client would be reliable.
- Results information can appear in both a financial-results filing and a related board-meeting outcome. Treating both as independent events creates duplicate cards and alerts, so I added deduplication.
- BSE's broad categories, especially General, are not specific enough to determine importance on their own. I put subject-based rules first and reserve model classification for ambiguous cases.

This phase shaped the ingestion pipeline and prevented the product model from depending on assumptions that the source data did not support.

## 3. Building the data model and ingestion pipeline

I designed the processing path around idempotency and evidence:

`fetch → normalise → upsert → classify → match triggers → enrich → notify`

Exchange identifiers are used to avoid inserting the same filing repeatedly. Classification is rules-first. When the category or subject is ambiguous, a model can help, but a failed or uncertain classification is not allowed to silently become Routine.

For results, I kept financial arithmetic in code. EBITDA is computed when it is not directly reported and is labelled as computed. PBT less tax is checked against PAT as a consistency test. This is more work than asking a model to produce a neat table, but it gives the result a reproducible basis.

## 4. Making research about evidence, not summaries

The Pull workflow retrieves recent transcripts and results material for an NSE ticker where source data is available. The worker extracts commitment candidates, including the topic, metric, target, timeframe, quotation and page reference.

The important work happens after extraction:

1. Verify each quotation against the cited page.
2. Drop quotations that cannot be matched.
3. Link mentions of the same commitment across reporting periods.
4. Distinguish stated, repeated, raised, lowered and silent mentions.
5. Compute numeric verdicts using code and available financial facts.
6. Keep qualitative judgements tied to the retrieved evidence.

Two edge cases required particular care:

- **Silence is not automatically failure.** Quietly dropped guidance requires explicit conditions, such as repeated silence or silence while performance is already behind. A completed target period is judged as a normal outcome instead.
- **Targets have scope.** A segment-level target must not be compared with company-wide totals. Margin targets expressed in basis points must be treated as changes, not absolute margin levels.

A research run can take around 5–7 minutes because it depends on external document retrieval, PDF extraction, model calls and verification. I chose to run this as background work and expose progress rather than make the user wait on a single interactive request.

## 5. Choosing the background architecture

I chose a Python CLI worker on GitHub Actions, with scheduled workflows for filings and end-of-day prices and a dispatched workflow for company research. Supabase Postgres stores the data and job state. The web application can observe progress through the job record.

This avoids operating an always-on worker service and keeps the infrastructure simple at the current scale. It is not the architecture I would choose for hundreds of concurrent long-running research jobs; the architecture audit documents the likely bottlenecks and migration path.

## 6. Designing the daily interaction

I wanted the app to feel like a focused mobile workflow rather than a desktop dashboard squeezed onto a phone.

The Today feed uses three levels of attention. The user can open a filing into a detail experience, move through items, and reach an explicit caught-up state. The assistant is available in context, rather than requiring the user to explain which company or filing they are looking at.

Several design decisions changed after testing:

- I replaced the original docked Ask bar with a floating assistant entry point because the bar competed with the content and navigation.
- I changed the Today default to seven days, while keeping the urgent hero count anchored to the last 24 hours. A longer history should help someone catch up, not redefine everything as urgent.
- I moved from an editorial serif/sans mix to a single Geist typeface because the mixed treatment distracted from dense financial information.
- I simplified the palette to off-white, ink, restrained pastels and a reserved coral action colour.

I used a mobile UX audit to identify issues in contrast, touch targets, truncation and information density, then used the findings to guide fixes. The audit remains in the repository as a dated review, so it should be read as a record of what was observed at that point in the build.

## 7. Debugging a production crash

One of the most useful debugging exercises involved the assistant. Asking a question caused a client-side error that could white-screen the app.

I reproduced the issue and traced it to an auto-scroll React effect. In the browser version involved, `scrollIntoView({ behavior: "smooth" })` returned a Promise. An expression-bodied effect returned that Promise to React, which treated it as a cleanup function. The fix was to use a braced effect body that returns no cleanup value, and to add an error boundary around the answer UI so a future rendering error would not take down the whole application.

The important lesson was procedural: reproduce the failure, inspect the actual runtime error, isolate the responsible code, then verify the fix. Guessing from the symptom would have been slower and less reliable.

## 8. Routing models and controlling cost

I used rules before models wherever possible. The worker uses Gemini for ingestion and research. The interactive assistant uses Groq with Gemini fallback, reflecting the different latency expectations of background research and interactive questions.

I added content-based caching for source material, model calls and research runs. The evaluation records a 24% model-call cache hit rate. The exact benefit depends on whether the source documents have changed.

## 9. Using AI as a product and systems auditor

I also used AI for two structured audits, separate from code generation.

For the **UX audit**, I asked it to work as a principal product designer, UX researcher, product manager and frontend QA engineer. The brief required a review of the deployed application, real user journeys, mobile behaviour, accessibility and information hierarchy, with findings ranked by user impact. The goal was to test whether the interface fulfilled FINN's promise of reducing noise, not simply whether it looked polished.

For the **systems audit**, I asked it to work as a founding CTO and principal systems architect. The brief required inspection of the actual Next.js application, Python worker, Supabase migrations, GitHub Actions workflows and AI integrations. It challenged the current architecture, traced user-facing and background-processing journeys, examined failure and security scenarios, and compared incremental optimisation with future scaling options. It explicitly prohibited invented performance figures, destructive tests and premature infrastructure changes.

The two reviews had different evidence standards: the UX audit focused on the live browser experience, while the systems audit focused on repository implementation and operational design. I treated their outputs as hypotheses and engineering inputs to validate, not as unquestionable answers. I reviewed findings, distinguished reproduced issues from unmeasured risks, and decided what to fix, defer or leave alone.

See [AUDIT_METHODOLOGY.md](AUDIT_METHODOLOGY.md) for the process and limitations, [UX_AUDIT.md](UX_AUDIT.md) and [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md) for the reports, and [audits/](audits/) for reusable review briefs.

## 10. What I learned about using AI in a real build

The tools made it possible to move quickly across frontend, backend, data pipelines and design review. But speed only helped when I kept ownership of the decisions.

I had to decide what the product should optimise for, which source failures mattered, what an LLM should be allowed to do, how uncertainty should be presented, and which generated changes were worth keeping. I also had to challenge outputs that sounded plausible but did not match the code or the running application.

My approach was to use AI to widen the set of options and accelerate execution, while keeping product judgment, verification and final responsibility with me.

## What I would do next

- Extend research to annual reports so capex, debt, working-capital and segment commitments can be tracked.
- Add guidance-aware alerts that compare reported results with management's earlier expectations.
- Expand the labelled evaluation set and have materiality judgements independently reviewed.
- Stream the assistant and improve time-to-first-token.
- Move background research to dedicated workers if workload and concurrency outgrow GitHub Actions.
