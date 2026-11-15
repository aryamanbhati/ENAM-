# FINN — product and system design

**Status:** shipped-product reference, updated for the current implementation.

FINN is a mobile-first financial intelligence prototype for the ENAM AI Engineer Build Challenge. Its job is to reduce the time an investor spends separating material developments from routine activity, while keeping the evidence behind each conclusion visible.

## 1. Product thesis

The challenge frames the scarce skill as filtering information rather than aggregating it. FINN takes the next step: **the filtering must be trustworthy**.

The product is organised around one question:

> Does anything in my portfolio actually need my attention?

That question shapes the information hierarchy, notification policy, research workflow and AI guardrails.

## 2. Product principles

1. **Prioritise, do not merely aggregate.** The first screen should distinguish urgency from background activity.
2. **Keep evidence close to conclusions.** Users should be able to inspect the filing, transcript, quotation or metric behind an item.
3. **Do not outsource arithmetic to an LLM.** Financial calculations and numeric verdicts belong in code.
4. **Fail visibly.** Uncertainty should move an item toward attention, not quietly hide it.
5. **Respect the user's attention.** Routine activity stays accessible but does not compete with important events.
6. **Build depth before breadth.** The first research workflow is deliberately focused on management commitments.

## 3. What shipped

### 3.1 Push: Today and portfolio triage

The seeded portfolio contains 19 NSE-listed companies. The Today feed combines corporate filings with end-of-day price and volume signals. Users can switch between 24-hour, 7-day, 30-day and custom windows; the current default is seven days.

The feed has three tiers:

| Tier | Meaning | Presentation |
|---|---|---|
| **Needs you** | Matches a configured announcement or market trigger | Highest prominence; eligible for push notification |
| **Worth knowing** | Relevant information that does not match a personal trigger | Compact summary |
| **Routine** | Lower-priority activity | Collapsed, but retained and expandable |

Only Needs you can generate a push notification. Announcement categories and market thresholds are configurable. Price and volume signals are computed from end-of-day data; the system can associate a signal with nearby filings, but it does not claim causation when no supporting filing is found.

The urgent hero count remains anchored to the recent 24-hour period even when the user expands the historical window. This keeps the meaning of urgency stable.

### 3.2 Filing enrichment

Selected filing types receive additional context:

- **Quarterly results:** Revenue, EBITDA, PBT and PAT, with QoQ and YoY comparisons where the source data supports them. EBITDA may be calculated from PBT, finance costs and depreciation/amortisation, and is labelled as computed.
- **Management changes:** profile information is extracted from the appointment filing when available.
- **Price/volume events:** nearby filings are surfaced as context; otherwise the UI explicitly says no filing explains the move.

### 3.3 Pull: company research

The research workflow can be run for NSE tickers beyond the seeded portfolio where the necessary source material is available. It uses recent earnings-call transcripts and results information to extract management commitments and follow them across reporting periods.

Each commitment can include:
- topic, metric, target and timeframe;
- a supporting quotation and page reference;
- its mentions and status across reporting periods;
- a verdict and the evidence used to reach it.

Numeric commitments are evaluated in code using extracted facts. Qualitative commitments are judged against retrieved source passages. The product also looks for **quietly dropped guidance**: a target that was stated and subsequently goes unmentioned. The rule requires more than a single missing mention; it is designed to avoid treating ordinary silence as proof of failure.

The research workflow is asynchronous and can take approximately 5–7 minutes depending on source retrieval, PDF extraction, provider latency and rate limits. The UI exposes job progress rather than presenting it as an instant response.

### 3.4 Contextual assistant

The assistant is available throughout the application and receives the current screen context. A router selects up to three relevant specialist paths, the answer is composed from their outputs, and a verification step checks source references. The user can inspect the answer's sources and model usage through **How I answered this**.

The web assistant uses Groq with Gemini fallback. Worker ingestion and research use Gemini. These are separate runtime paths and are not represented as a single shared model gateway.

## 4. Interaction and visual system

FINN is designed mobile-first as an installable PWA.

The current visual system uses:
- Geist as the single typeface, with tabular numerals for figures;
- an off-white background, white surfaces and dark ink text;
- restrained pastel surfaces for secondary information;
- coral as a reserved action accent;
- green and red for directional financial meaning.

The app uses a bottom navigation dock and a floating assistant entry point. The design favours a single-column reading experience, compact secondary information and progressive disclosure for source detail.

The current implementation is light-theme focused. Earlier design explorations included a serif/sans pairing and additional theme variants; these were not retained in the shipped interface.

## 5. System architecture

```text
Mobile browser / PWA
       │
       ▼
Next.js App Router on Vercel
  ├── server-rendered application views
  ├── /api/ask       contextual assistant
  └── /api/research  guarded research dispatch
       │                       │
       ▼                       ▼
Supabase Postgres         GitHub REST API
  ├── companies                 │
  ├── holdings                  ▼
  ├── filings             GitHub Actions
  ├── prices_eod           Python CLI workers
  ├── facts                  ├── filings
  ├── documents              ├── end-of-day prices
  ├── chunks                 └── company research
  ├── promises                    │
  ├── signals                     │
  ├── jobs ◄── progress ──────────┘
  └── caches
```

### Runtime responsibilities

| Component | Responsibility |
|---|---|
| Next.js / Vercel | PWA, server-rendered views and API routes |
| Supabase Postgres | System of record for portfolio, filings, facts, research, jobs and caches |
| GitHub Actions | Scheduled ingestion and dispatched research jobs |
| Python worker | Source retrieval, parsing, extraction, verification and persistence |
| Gemini | Worker-side classification, extraction and research |
| Groq with Gemini fallback | Interactive web assistant |

The web application uses server-side access to Supabase. The current prototype is single-user; it is not a multi-tenant application and should not be treated as one.

## 6. Main data flows

### Filings

1. Fetch new exchange announcements for portfolio companies.
2. Normalise and upsert filings using exchange identifiers.
3. Classify with deterministic rules first.
4. Use a model only for ambiguous cases.
5. Match configured triggers.
6. Enrich relevant filings and create deduplicated alerts.
7. Send web push only for qualifying Needs you items.

### End-of-day market data

1. Retrieve daily prices and volumes.
2. Compute price movement and volume multiples in code.
3. Compare signals with configured thresholds.
4. Associate nearby filings as context where available.
5. Persist the signal and any alert.

### Company research

1. Retrieve transcript and results sources for the requested ticker.
2. Extract document text and page boundaries.
3. Extract candidate commitments with source quotations.
4. Verify each quotation against its cited page.
5. Link repeated commitments across periods.
6. Compute numeric verdicts in code; keep qualitative judgements evidence-based.
7. Persist research artefacts and job progress.

### Assistant

1. Read the question and current screen context.
2. Route to no more than three relevant specialist paths.
3. Retrieve structured data or primary-source evidence.
4. Compose an answer from specialist outputs.
5. verify source references and expose provenance to the user.

## 7. Reliability and trust controls

- **No model-generated financial arithmetic:** calculations and numeric verdicts are performed in code.
- **Page-level quote verification:** unmatched quotations are discarded.
- **Citation checks:** unsupported assistant sentences are removed by the verification step.
- **Fail-upward classification:** uncertain or failed classification does not silently become Routine.
- **Primary-source research:** the Pull workflow is restricted to company transcripts and results material available to it.
- **Honest missing-data states:** no explicit guidance or insufficient evidence are valid outcomes.
- **Idempotency and caching:** exchange IDs and content-derived cache keys reduce duplicate processing.
- **Background progress:** long research work is represented by a job record that the UI can observe.

These controls reduce known failure modes; they do not guarantee that every extraction or classification is correct. The evaluation caveats and remaining risks are documented in the architecture audit and write-up.

## 8. Scope decisions

The first version prioritises portfolio triage and management-commitment research. It does not attempt to deliver a complete institutional research terminal.

Deliberately excluded or deferred:
- comprehensive bull/bear investment cases;
- full balance-sheet, cash-quality and working-capital analysis;
- full annual-report coverage;
- multi-user authentication and per-user data isolation;
- a native iOS or Android client.

The installable PWA keeps the prototype usable on mobile without maintaining separate native applications.

## 9. Known trade-offs and next steps

GitHub Actions is inexpensive and convenient for the current background workload, but its execution limits and cold starts are not ideal for sustained high-volume research. Supabase currently serves both operational data and retrieval workloads. The feed re-queries on navigation, and assistant latency can be improved through streaming and better scheduling of work.

The next engineering steps are:
1. instrument p50/p95 latency across feed, assistant and research stages;
2. reduce repeated feed queries with a carefully invalidated read cache;
3. stream assistant output so users see progress earlier;
4. add research checkpoints so retries do not repeat completed stages;
5. move background processing to dedicated workers if usage outgrows Actions.

For measured findings and severity-ranked recommendations, see [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md). For the mobile interaction review, see [UX_AUDIT.md](UX_AUDIT.md).
