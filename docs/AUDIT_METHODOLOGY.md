# FINN — audit methodology and AI-assisted engineering

FINN was not evaluated only by asking an AI assistant whether the product or architecture looked good. I created two structured audit briefs and used them to direct separate reviews of the running product and the source code.

The intent was to use AI as a **critical review instrument**: define the role, scope, user journeys or system boundaries, evidence expected, failure cases to examine, and the deliverables. I remained responsible for choosing the questions, reviewing the findings, deciding which recommendations were valid, and implementing or deferring changes.

This document explains that process so a reviewer can understand not only what FINN became, but how I inspected and improved it.

## Two complementary audits

| Audit | Review lens | Primary evidence | Main output |
|---|---|---|---|
| UX and Product Design Audit | Principal product designer, UX researcher, product manager and frontend QA | Live deployed application, browser interactions, mobile viewport, DOM/console inspection and rendered contrast | [UX audit](UX_AUDIT.md) |
| Systems Architecture, Performance and Reliability Audit | Founding CTO / principal systems architect | Repository source, database migrations, API routes, Python worker, GitHub workflows, provider integrations and existing evaluation/telemetry | [Architecture audit](ARCHITECTURE_AUDIT.md) |

The reviews deliberately use different evidence. A live-site UX review can establish what a user sees and how an interaction behaves. A code-level systems review can establish how a request, job or data pipeline is implemented. Neither should be substituted for the other.

## 1. UX audit: inspect the experience as a user

I framed the UX review as a multi-disciplinary design and QA exercise rather than a request for visual feedback.

The review was directed to:

- understand FINN's purpose and information hierarchy before judging individual components;
- inspect typography, spacing, colour, cards, controls and navigation;
- exercise first-time, returning-user, historical-filter, filing-detail, briefing and mobile scenarios;
- test accessibility concerns including contrast, touch targets, focus visibility and semantic clarity;
- evaluate whether the three triage levels — Needs you, Worth knowing and Routine — make sense as a product model;
- compare interaction principles with established financial and consumer products without copying their visual identities;
- rank findings by user impact and provide concrete implementation recommendations.

The review snapshot records a 390px mobile viewport and describes browser reproduction, console/DOM inspection and contrast calculations. It also separates functional defects from visual polish and accessibility issues.

**Why this mattered:** FINN's promise is to reduce noise. A beautiful feed that duplicates events, hides the important part of a headline, or makes an urgent count feel meaningless contradicts the product thesis. The audit forced the interface to be judged against the job it is supposed to do.

See the [UX audit report](UX_AUDIT.md) and the [UX audit brief](audits/prompts/UX_REVIEW_BRIEF.md).

## 2. Systems audit: challenge the implementation, not the diagram

I framed the systems review as a founding-CTO investigation. The instruction was not to rebuild the app or recommend fashionable infrastructure. It was to inspect what exists, identify evidence-backed weaknesses, and explain when the current design would stop being appropriate.

The review covered:

1. **Architecture reconstruction:** trace browser, Next.js/Vercel, API routes, Supabase, GitHub Actions, Python workers, external data sources and model providers.
2. **Decision review:** challenge serverless execution, GitHub Actions as a worker runner, Postgres as the system of record, source adapters and model routing.
3. **Latency journeys:** opening the feed, changing filters, opening a filing, asking the assistant and dispatching research.
4. **Worker pipelines:** ingestion, EOD processing, transcript retrieval, PDF parsing, extraction, verification, matching and persistence.
5. **AI reliability:** model routing, structured output, retries, caching, quote verification and deterministic calculations.
6. **Financial guardrails:** traceability of numbers, units, periods, quote/page references and commitment verdicts.
7. **Security and failure modes:** secrets, service-role access, endpoint abuse, prompt injection, provider outages, job failures and duplicate work.
8. **Caching and data delivery:** keys, invalidation, stale data, cache effectiveness and opportunities for read models.
9. **Observability and testing:** latency percentiles, job health, quality metrics, cost, regression and failure-injection strategy.
10. **Architecture options:** optimise the existing design first, identify a production-grade evolution path, and describe what would only be justified at larger scale.

The operating constraints were important: inspect actual code, distinguish documentation from implementation, do not invent latency numbers, do not run destructive tests, and do not change production infrastructure during the audit.

**Why this mattered:** it prevented the review from becoming a generic recommendation to add Redis, microservices or a hosted queue. The right question was whether a proposed component solves a demonstrated problem at FINN's current scale, and what operational complexity it introduces.

The report reconstructs the current architecture, records documentation drift, reviews existing decisions and distinguishes measured observations from items requiring instrumentation. It is a dated audit snapshot, not a claim that every recommendation remains open.

See the [architecture audit report](ARCHITECTURE_AUDIT.md) and the [systems audit brief](audits/prompts/SYSTEMS_AUDIT_BRIEF.md).

## 3. How findings became engineering work

I treated the reports as review inputs, not as an automatic backlog. For each finding, the decision process is:

1. **Check the evidence.** Can I reproduce the behaviour, find the code path, or identify the data supporting the claim?
2. **Classify the issue.** Is it a functional bug, correctness risk, reliability risk, performance opportunity, accessibility issue, or subjective design preference?
3. **Assess impact.** Does it affect trust, user comprehension, the core workflow, security, or only visual polish?
4. **Choose an action.** Fix now, defer, monitor, or reject the recommendation with a reason.
5. **Validate the change.** Re-test the relevant user journey or code path; do not call a recommendation implemented merely because it appears in a report.

The audit documents preserve the review snapshot and rationale. They should be read alongside the current code and commit history when assessing the state of the product.

## 4. What AI contributed — and what remained my responsibility

AI helped me broaden the review, generate adversarial questions, organise evidence, and turn observations into concrete options. The prompts gave it a defined role and a rigorous checklist, but they did not make its conclusions authoritative.

My responsibility was to:
- choose the product and engineering questions worth investigating;
- provide the repository and live application as the objects of review;
- distinguish observable evidence from hypotheses and missing telemetry;
- challenge recommendations that added complexity without a demonstrated need;
- decide what to implement and what to leave out;
- verify important changes against the application and source code.

The prompts in `docs/audits/prompts/` are concise, reusable briefs distilled from the longer audit instructions used during the reviews. They preserve the role, scope, evidence expectations and constraints; they are not presented as verbatim transcripts of the original sessions.

## 5. Limits of the audits

- The UX report describes a dated browser review. The live application may have changed since then; re-test before treating every finding as an open defect.
- The systems report is a source-level architecture review. It does not imply that every end-to-end latency path was instrumented under production load.
- Where telemetry was unavailable, the systems audit calls that out instead of inventing p50/p95/p99 figures.
- An AI-assisted review can miss defects or produce an incorrect interpretation. High-impact findings still require reproduction, source inspection or independent validation.

The point of this process was not to claim that FINN had been exhaustively proven production-ready. It was to make the reasoning, evidence, trade-offs and remaining uncertainty visible.
