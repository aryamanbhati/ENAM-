# FINN — submission checklist

This document is the final submission reference for the ENAM AI Engineer Build Challenge.

## Email details

- **To:** assessment@enam.com
- **Subject:** `IIT Delhi – AI Engineer - 2027`

## Covering email

Hi,

I'm sharing my submission for the AI Engineer Build Challenge: **FINN, a mobile-first financial intelligence platform designed to help investors focus on what actually matters.**

**Submission links**

- **Live application:** https://enam-six.vercel.app
- **GitHub repository:** https://github.com/aryamanbhati/ENAM-
- **AI build history:** [docs/BUILD_HISTORY.md](https://github.com/aryamanbhati/ENAM-/blob/main/docs/BUILD_HISTORY.md)
- **AI-assisted audit methodology and prompts:** [docs/AUDIT_METHODOLOGY.md](https://github.com/aryamanbhati/ENAM-/blob/main/docs/AUDIT_METHODOLOGY.md) and [docs/audits/prompts/](https://github.com/aryamanbhati/ENAM-/tree/main/docs/audits/prompts)
- **UX audit:** [docs/UX_AUDIT.md](https://github.com/aryamanbhati/ENAM-/blob/main/docs/UX_AUDIT.md)
- **Systems architecture audit:** [docs/ARCHITECTURE_AUDIT.md](https://github.com/aryamanbhati/ENAM-/blob/main/docs/ARCHITECTURE_AUDIT.md)
- **Product-design conversation:** [add Claude.ai share link if you want to include the original discussion]

For the intended experience, please open FINN on your phone, add it to your home screen, and enable notifications. FINN is an installable PWA, and this is how its web-push workflow is best experienced.

**A note on research runtime:** the Pull workflow can take approximately **5–7 minutes**. It retrieves external transcripts and financial documents, then extracts, verifies and evaluates the evidence. Public data sources and APIs have variable response times and rate limits, so please allow the run to finish.

### What I built

The core idea behind FINN is that investors do not need another place to read everything. They need help deciding what deserves their attention, without losing the ability to verify why.

FINN has two main workflows:

- **Push:** a prioritised feed across a 19-company NSE portfolio. Filings and market signals are organised into Needs you, Worth knowing and Routine. Configurable announcement and market triggers determine what can generate a notification. Results, management changes and unusual price/volume moves receive additional context.
- **Pull:** on-demand research for NSE-listed companies where source material is available. FINN extracts management commitments from earnings-call transcripts, follows them across periods, verifies supporting quotations against source pages, and evaluates measurable targets in code. It also looks for guidance that was stated and later quietly dropped.

A contextual assistant is available throughout the app. It routes questions to relevant specialist data and retrieval paths, composes an answer, and exposes its supporting sources and model usage.

### Key decisions and trade-offs

I chose GitHub Actions for scheduled and on-demand Python workers, Supabase Postgres for persistence and job state, and Next.js on Vercel for the mobile-first application. This keeps the prototype lightweight and avoids running idle infrastructure. It is a deliberate choice for the current workload; sustained high-volume research would justify dedicated workers and a proper queue.

I also separated probabilistic language tasks from deterministic financial work. Models classify, extract and explain; code performs calculations, reconciliations and numeric verdicts. Quotes must match their cited pages, assistant claims need source references, and uncertain filing classifications are kept visible rather than silently buried.

Finally, I used rules-first processing, model routing and content-based caching to keep inference usage low. The worker uses Gemini for ingestion and research; the interactive assistant uses Groq with Gemini fallback.

### How I used AI during the build

I used AI tools for implementation and iteration, but also as structured critics of the product and its architecture. I created two separate audit briefs: one asked AI to review the live application as a principal product designer and UX team; the other asked it to inspect the repository as a founding CTO and systems architect.

The UX review examined real user journeys, mobile usability, accessibility and information hierarchy. The systems review reconstructed the implementation, challenged architecture choices, traced latency and failure paths, and considered reliability, security and scaling. I treated the reports as inputs to judgement, not as unquestionable answers: I reviewed evidence, distinguished observed issues from unmeasured risks, and decided what to fix or defer.

The build history, audit methodology, prompts and resulting reports are linked above in the repository so the review process is inspectable.

### What I left out

I prioritised portfolio triage and management-commitment research over breadth. Comprehensive bull/bear analysis, balance-sheet and cash-quality sections, full annual-report coverage, multi-user authentication and a native mobile application are outside this prototype's scope. I chose an installable PWA rather than maintaining separate native clients.

### Where I would take it next

I would extend research to annual reports so capex, debt, working-capital and segment commitments can be measured; add guidance-aware alerts when reported results diverge from management's expectations; improve the classifier using a larger independently reviewed dataset; and move background work to dedicated workers if usage grows.

The principle I kept returning to while building FINN was simple: **an AI system in financial research should not just produce convincing answers; it should make those answers verifiable.**

Thank you for the opportunity. I genuinely enjoyed working on this challenge.

Best regards,  
Aryaman Bhati  
IIT Delhi

---

## Final pre-send checklist

- [ ] Confirm the repository is public and accessible to reviewers.
- [ ] Open the deployed app on a phone and check Today, Portfolio, Research and the assistant.
- [ ] Test the PWA installation and notification permission flow on a supported device/browser.
- [ ] Open the build-history, audit-methodology and audit-report links in a private/incognito window.
- [ ] Add the Claude.ai product-design conversation share link if you want to include the original discussion.
- [ ] Send to assessment@enam.com with the exact subject above.

## Reviewer map

- `README.md` — project overview, setup and repository map.
- `docs/WRITEUP.md` — detailed product and engineering write-up.
- `docs/DESIGN.md` — product principles, shipped behaviour and system design.
- `docs/BUILD_HISTORY.md` — development narrative and AI collaboration.
- `docs/AUDIT_METHODOLOGY.md` — why and how the AI-assisted audits were conducted.
- `docs/audits/prompts/` — reusable UX and systems audit briefs.
- `docs/ARCHITECTURE_AUDIT.md` — performance, reliability and scaling review.
- `docs/UX_AUDIT.md` — mobile UX and accessibility review.
- `eval/` — evaluation data and scripts.
