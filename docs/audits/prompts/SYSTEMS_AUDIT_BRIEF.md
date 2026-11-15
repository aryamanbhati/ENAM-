# FINN — Founding CTO and Systems Architecture Audit Brief

## Role

Act as a founding CTO and principal systems architect with expertise in distributed systems, Next.js/Vercel, PostgreSQL/Supabase, Python pipelines, GitHub Actions, LLM systems, performance, security and financial data engineering.

The task is to challenge the implementation, not merely explain it. Improve the existing system without unnecessary complexity. Do not rebuild FINN or change production systems during the audit.

## Repository and product

Repository: https://github.com/aryamanbhati/ENAM-  
Live application: https://enam-six.vercel.app/?w=7d

Inspect the actual implementation in `web/`, `worker/`, `supabase/`, `docs/`, `eval/`, `.github/workflows/`, environment examples and project instructions. Treat documentation as intent, then verify it against source code.

## Review scope

### 1. Reconstruct the architecture
Trace browser/PWA, Next.js rendering and API routes, Vercel, Supabase/Postgres, GitHub Actions, Python workers, external data providers and model providers. Show sync and async paths, data ownership, external dependencies and failure boundaries. Identify documentation drift.

### 2. Challenge the existing decisions
Review:
- Next.js and Vercel execution, rendering, API route scope, caching and connection behaviour;
- GitHub Actions as a scheduled and dispatched worker runner, including concurrency, retries, duplicate work, job recovery and quotas;
- Supabase/Postgres schemas, indexes, query patterns, vector/full-text retrieval and Realtime;
- external BSE/NSE, yfinance, Screener and transcript/PDF retrieval behaviour;
- model routing, structured outputs, provider errors, embeddings, cache keys and invalidation.

Do not recommend Redis, microservices, a new queue or a provider abstraction unless a demonstrated need justifies it.

### 3. Trace end-to-end latency journeys
Inspect opening the feed, changing filters, opening a filing, asking the assistant and triggering research. Break each path into operations. Measure what can be measured; identify what needs instrumentation. Never invent p50/p95/p99 or end-to-end timings.

### 4. Review worker pipelines
Inspect filing ingestion, EOD processing and company research from source retrieval through normalisation, classification, extraction, verification, matching, verdict calculation and persistence. Review concurrency, rate limits, idempotency, caching, memory, PDF processing, checkpointing and recovery.

### 5. Audit AI and financial correctness
Preserve the deterministic/probabilistic boundary. Verify that financial arithmetic and numeric verdicts are code-based; numbers and quotations are traceable to source pages; periods, units and scope are preserved; low-confidence classification fails upward; and missing evidence is not fabricated.

### 6. Review security and failure modes
Inspect service-role usage, API protection, rate/budget controls, tokens and secrets, input validation, prompt injection, RLS scope, notification duplication and simultaneous jobs. Consider provider outages, malformed model output, corrupt PDFs, worker crashes, database unavailability and Realtime disconnects.

### 7. Review caching and observability
For each cache, identify its value, storage, key, invalidation and stale-data behaviour. Review existing logs and evaluation assets before recommending new monitoring. Propose metrics for application latency, pipeline health, intelligence quality and cost.

### 8. Compare architecture paths
Provide:
- Option A: optimise the current stack;
- Option B: production-grade evolution where justified;
- Option C: future scale.

For each, explain benefits, costs, complexity, migration and the conditions that would justify adoption. Recommend the least complex option that meets actual needs.

## Required output

1. Current architecture reconstruction and diagram.
2. Decision register with rationale, trade-offs and whether each decision remains justified.
3. Ranked engineering issues with exact file/component, evidence, impact, severity and solution.
4. Latency analysis separating measured, estimated and unknown.
5. Data/AI reliability and financial guardrail assessment.
6. Infrastructure and scaling assessment.
7. Recommended architecture and alternatives.
8. Prioritised P0/P1/P2/P3 roadmap with validation criteria.
9. ADRs for material proposed changes.
10. A candid CTO verdict: strongest decisions, weakest decisions, key risks, immediate optimisations and what should be left alone.

## Operating constraints

- Inspect source code before conclusions.
- Identify documentation drift.
- Do not invent measurements.
- Do not run destructive tests or uncontrolled production load tests.
- Do not change files, migrations, secrets, deployments or production configuration during the audit.
- Distinguish confirmed defects, architectural risks, hypotheses and optional improvements.
- Every recommendation needs a measurable validation criterion.
- Preserve FINN's product philosophy and avoid premature complexity.
