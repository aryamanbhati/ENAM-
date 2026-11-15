# FINN — engineering and product write-up

**Live:** https://enam-six.vercel.app  
**Repository:** https://github.com/aryamanbhati/ENAM-

FINN is a mobile-first financial intelligence prototype built around a simple question: **does anything in my portfolio actually need my attention?**

The problem is not a lack of financial information. Investors already have more filings, prices, announcements and commentary than they can reasonably process. The harder problem is deciding what matters without losing trust in the process.

My central design choice was therefore to treat **trustworthy filtering** as the product, not as a layer added after aggregation. A feed that occasionally hides a material event or invents a financial fact is worse than a noisy feed: users eventually stop trusting it.

## What FINN does

### Push: a portfolio that knows when to interrupt

The Today view monitors filings and end-of-day market signals across a seeded portfolio of 19 NSE-listed companies. It sorts activity into three tiers:

- **Needs you** — matches a user's configured announcement or market trigger.
- **Worth knowing** — relevant, but not urgent for that user's current settings.
- **Routine** — retained in the feed but collapsed to reduce visual noise.

Users can choose a time window, including 24 hours, 7 days, 30 days and a custom range. The urgent hero count remains anchored to the recent 24-hour period, so widening the history does not turn the interface into a wall of alerts. Only the Needs you tier can generate a push notification.

FINN adds context to selected events: quarterly results are enriched with headline financial metrics and period comparisons; management changes include profile details available in the filing; and price/volume spikes are connected to nearby filings where possible. When no filing explains a move, the interface says so rather than inventing a cause.

### Pull: what management promised, and what happened next

The research workflow accepts NSE tickers beyond the demo portfolio when source material is available. It retrieves recent earnings-call transcripts and results information, extracts explicit commitments, verifies each quotation against its cited page, and links mentions across reporting periods.

Numeric commitments are evaluated using code and available financial facts. Qualitative commitments are treated separately and remain tied to source passages. FINN also looks for **quietly dropped guidance**: a target that management stated and later stopped discussing. This signal is governed by explicit conditions; silence alone is not enough to declare a target abandoned.

A research run may take around **5–7 minutes**, depending on external source availability, transcript retrieval, model response times and rate limits. This is a background research workflow, not an instant chat response.

### Contextual assistant

The assistant is available across the application and uses the current screen as context. A router selects up to three relevant specialist paths, their results are composed into an answer, and a verification step checks source references. The **How I answered this** panel makes the sources and model usage inspectable.

## The engineering choices

### 1. Keep background processing simple until the workload justifies more

The web application runs on Next.js and Vercel. Supabase Postgres stores application data, research artefacts, caches and job state. Python CLI workers run through GitHub Actions: scheduled workflows handle filings and end-of-day prices, while an on-demand workflow handles company research.

The `jobs` table provides durable progress and coordination for the UI. GitHub Actions concurrency controls help prevent overlapping research runs for the same ticker. This avoids maintaining an always-on worker service and keeps idle infrastructure cost low.

That is a scale-appropriate trade-off, not a claim that GitHub Actions is a universal queue solution. If research volume or latency requirements grew substantially, I would move long-running work to dedicated workers backed by a proper queue, while retaining Postgres as the system of record.

### 2. Separate model interpretation from financial computation

Models are useful for classification, extracting commitments, searching language and drafting explanations. They are not the authority for financial arithmetic.

The pipeline keeps deterministic and probabilistic work separate:

- Financial values are extracted from source documents and checked against their cited pages.
- Derived values, period comparisons and numeric verdicts are computed in code.
- Quotations are checked against the page they reference; failed matches are discarded.
- Qualitative judgements must remain tied to retrieved source evidence.

For example, EBITDA is computed from PBT, finance costs and depreciation/amortisation when it is not directly reported, and is labelled as computed. PBT less tax is also checked against PAT as a consistency test.

### 3. Make uncertainty visible

Filing classification is rules-first. Clear categories are handled deterministically; ambiguous categories can be sent to a model. A low-confidence result or model failure must not silently push an item into Routine. The safe fallback is a more visible tier.

The same principle applies to research: “not found in the documents” is a legitimate result. The system should not manufacture a commitment or force a verdict to make a scorecard look complete.

### 4. Cache by content, not by the user's last click

Source documents are cached using content-derived identifiers. Model responses are keyed by the model, prompt version and input. Research is associated with the set of source documents used to produce it.

This reduces repeated extraction and inference when the underlying material has not changed. The current evaluation records a 24% model-call cache hit rate. The exact benefit varies with the ticker and whether new source documents have arrived.

### 5. Choose models by workload

The worker uses Gemini for ingestion and research. The interactive web assistant uses Groq with Gemini fallback, reflecting the different latency expectations of an interactive question versus a longer background research run.

Rules handle straightforward cases before model calls. Cheaper model calls are used for bulk extraction; stronger reasoning is reserved for tasks that need it. Calls are logged with model, token, latency and cost information.

## Guardrails

The following controls are implemented in the pipeline rather than left as prompt instructions:

1. **Financial numbers are not invented by the model.** Extraction, validation and arithmetic are handled by code.
2. **Quotes must match their cited page.** A failed verification means the quote is removed.
3. **Assistant claims need source references.** The post-generation check removes unsupported sentences.
4. **Classification fails upward.** Uncertainty is kept visible rather than silently buried in Routine.
5. **Research is grounded in primary company documents.** The Pull workflow uses transcripts and results filings, not news articles or broker notes.
6. **Missing evidence remains missing.** The system can report that it found no explicit guidance or insufficient evidence to judge a commitment.

These controls reduce specific failure modes; they do not make the system infallible. The evaluation and known limitations are documented separately.

## Evaluation

The repository's `eval/` directory contains the labelled examples and evaluation scripts.

| Measure | Current result |
|---|---:|
| Filing classification, rules only | 90.9% on 99 labelled filings |
| Filing classification, rules + model | 91.9% on the same set |
| Results figures within 1% of Screener, before cross-check | 78.6% |
| Results figures within 1%, after cross-check | 84% |
| Extracted promise quotes that passed page verification | 86.5% |
| Model-call cache hit rate | 24% |

I labelled the evaluation set myself. These figures describe performance on that set; they should not be read as independently measured production recall. In the classifier evaluation, one material item was hidden. That is the most important error class to reduce, and a larger independently reviewed evaluation set is a clear next step.

The ingestion and research workflows ran on free-tier model access during the build, so actual model spend was $0. Based on the recorded calls and paid list-price estimates, the build's model usage was approximately $0.32 and a research run approximately $0.04. These are estimates, not a guarantee of future provider pricing or availability.

## What I deliberately left out

I chose to make portfolio triage and management-commitment research work before expanding into every analysis suggested by the brief. The prototype does not yet provide comprehensive bull/bear cases, balance-sheet and cash-quality analysis, full annual-report coverage, multi-user authentication, or a native iOS/Android application. It uses an installable PWA instead.

These are scope decisions, not claims that the omitted areas are unimportant.

## What I would build next

1. **Annual-report research:** extend commitment tracking to capex, debt, working capital and segment-level targets, where the source data supports reliable measurement.
2. **Guidance-aware results alerts:** compare new reported results with management's earlier guidance and surface meaningful deviations as soon as results are processed.
3. **A stronger evaluation process:** expand the labelled dataset, add independent review, and focus especially on material filings incorrectly classified as Routine.
4. **Scalable background execution:** move long-running research to dedicated workers and a durable queue if volume makes GitHub Actions an operational bottleneck.
5. **Personalised triage:** let users tune portfolios and alerts, then learn from explicit feedback without making important events disappear silently.

## Closing thought

The most important work in FINN was not getting a model to produce a fluent answer. It was deciding where the model should stop, what the code must verify, how uncertainty should be handled, and how a user can trace an answer back to the document that supports it.

I wanted to build a system that does not ask users to trust an AI because it sounds confident. It gives them evidence so they can decide whether the answer deserves their trust.
