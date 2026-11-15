# FINN — AI build history

How FINN was built, and how I worked with AI coding agents to build it. This is a curated narrative of the development journey: the decisions, the trade-offs, the dead ends I backed out of, and the reasoning at each step. The raw agent transcripts are attached separately; this is the map that makes sense of them.

**How I worked.** I used two surfaces deliberately. **claude.ai** for product and design thinking (arguing out the thesis, the interaction model, what to cut). **Claude Code** as the engineering pair for implementation, with me directing, reviewing, and course-correcting at every step. I treated the agent as a fast, literal implementer, not an oracle: I set the architecture and the guardrails, made every product call myself, and verified its output rather than trusting it. Where it drifted, I caught it and redirected. That discipline is the thread through everything below.

---

## Phase 1 — The thesis, and scoping with a scalpel

Before writing any code I forced myself to answer one question: what is the actual scarce skill here? The brief said it's filtering, not aggregating. I pushed that further: for an investment firm the scarce skill is **filtering you can trust**. A feed that is 95% right is worse than no feed, because the first time it buries something material the investor stops believing it. That reframing drove every later decision.

From that, three scoping calls I made up front and held to:

- **Depth over breadth.** The brief listed eight possible pull-side analyses. I deliberately built **one** of them properly, "promised vs delivered," because the brief literally said that is the output they value most, and because a demo that nails one workflow beats one that spreads thin. I wrote the cuts down on purpose (bull/bear, balance sheet, cash quality) so the trade-off was a decision, not an omission.
- **A triage model, not a feed.** Three tiers, *Needs you / Worth knowing / Routine*, with routine collapsed, never deleted. The product answers "does anything need me?" before showing anything.
- **The signature insight: "quietly dropped."** A guidance target stated once and then never mentioned again. This is the line between *summarising* management and *analysing* them, and I made it the hero of the research page.

I ran this phase in plan mode: propose the architecture, argue it, then build. Nothing was coded until the thesis held up.

---

## Phase 2 — Data spike: the unglamorous part where correctness is won

The data sources are "plumbing," but plumbing is exactly where a finance product breaks. I spiked all three sources first and hit real problems that needed judgment, not just code:

- **BSE blocks plain HTTP clients** (Akamai returns 403 to `httpx`) and intermittently returns empty bodies even when it answers. I routed filings through the `bse` package with a 1.5s throttle and backoff, and confirmed GitHub Actions runners are accepted, so the ingestion cron needs no other host.
- **Results get filed twice on the same day** (the "Financial Results" document and the board-meeting outcome that encloses it). Naively that double-counts and double-alerts. I collapse them to one: the results filing triggers, the enclosing outcome steps down to Worth knowing, deduped with a unique DB constraint.
- **"General" is BSE's vaguest and most common subcategory** (~20% of filings). I run subject-keyword rules first and only send what the rules can't place to a cheap model, which may only move a filing *down* to routine when it is confident.

The point of this phase was to learn the domain's edge cases before committing to a schema.

---

## Phase 3 — Schema and pipelines, built guardrails-first

I designed the data model around one rule: **the model never produces a number, and never makes a claim it can't point to.** Deterministic work (every figure, every verdict, every QoQ/YoY) is done in code; the model only classifies, extracts and writes prose. They never cross. That isn't a prompt instruction, it's enforced by what each component can touch.

The filings pipeline became: fetch → upsert by exchange ID (idempotent) → rules tier → cheap-model tier for vague categories (failing *upward*, so uncertainty is shown, never buried) → trigger match → enrich → dedupe alert → web push. EBITDA, which filings rarely report, I compute (PBT + finance costs + D&A) and label as computed, and reconcile PBT−tax against PAT as a sanity check.

Infra decision I'm happy with: **no servers to babysit.** The whole backend is a Python CLI on GitHub Actions, cron for filings/prices and per-ticker dispatch for research, with the `jobs` table acting as the queue. Idempotent, serialized, retryable, zero idle cost. Correct for this scale, and I documented exactly when it would stop being enough.

---

## Phase 4 — The research pipeline (the hard, interesting one)

This is where the "promised vs delivered" analysis is produced for any NSE ticker. The flow: pull screener facts into the DB; collect the last six concall transcripts; extract each explicit commitment (topic, metric, target, timeframe, quote, page) with a cheap model; **verify every quote against the page it cites** and drop the ones that don't match; link the same promise across quarters; then compute the verdict *in code* for numeric targets, letting the model judge only qualitative ones, and only with passages it can cite.

Two judgment calls I'm proud of here:

- **"Quietly dropped" has to be earned, not guessed.** It requires two consecutive silent calls, or one silent call while the numbers are already behind. Never when the company is on or ahead of target, and never once the deadline year is complete (that earns a real verdict). This is the difference between an insight and a hallucination.
- **Commitments carry a scope.** Only company-wide targets are compared against reported totals; a segment target is routed to the evidence-based qualitative judge, never silently measured against the company total. Margin targets in basis points are measured as a change, not a level.

---

## Phase 5 — The frontend and the interaction model

The brief said the frontend is the heart, so I spent real effort on the point of view, not just the data. The Today screen is a swipeable triage stack that ends on an honest "You're caught up." Pushed items are enriched by type: results show the four headline numbers QoQ/YoY, a management change pulls the incoming person's bio *from the filing itself* (not LinkedIn), and a price spike is joined to the filing that explains it or labelled "no filing explains this move."

I iterated hard on the interaction model and wasn't precious about my first attempts. A few examples where I changed my mind on purpose:

- The assistant started as a docked "Ask" bar; it overlapped content and felt bolted on. I replaced it with a **floating agent** scoped to the current screen.
- The triage count broke its own promise on a 30-day window (it showed "104 need you"). I reworked the hero so it always shows the *last-24h urgent* number, with older items as a calm "+N earlier." The product's promise had to survive the window picker.
- I noticed the Needs-you cards repeated the company name (header + headline) and looked redundant, so I stripped the repeat. When a first attempt to distinguish them used a thick coloured side-rail, I recognised that as a generic "AI-made" tell and replaced it with a subtle, *meaningful* marker instead.

Those are not course-corrections from being lost; they're the normal work of taste, catching things that were almost-right and making them right.

---

## Phase 6 — The assistant, as a small multi-agent system

A router reads the question and screen context and picks at most three narrow specialists (market and filings answered in code, transcripts via hybrid search). A composer writes only from their outputs. A verifier then deletes any sentence without a valid source id, so the model literally cannot speak without a citation. Every answer exposes "How I answered this": the agents, sources, tokens and cost. On the research page the agent is walled to that company's own primary documents and nothing else.

---

## Phase 7 — Design: iterating toward a point of view

The visual identity went through deliberate revisions, each one a reaction to something concrete. An early editorial serif read as "designer-y" against financial data, so I committed to a single clean sans with tabular numerals. I simplified the palette to an off-white + ink base with a reserved coral for the single primary action and two quiet pastels for tinted surfaces, and checked every text/background pair against WCAG AA. When a review surfaced low-contrast figures on the dark portfolio card, I brightened the on-dark green and coral specifically for that surface. The rule throughout: **colour only ever carries meaning.**

I also commissioned the agent to run a full UX audit of the live app at phone width and acted on it: fixed real contrast failures, touch-target sizes, headline truncation, and an overlapping control. Using the tool to critique my own work, then fixing what it found, is part of how I kept quality up.

---

## Phase 8 — Hardening: a real bug, debugged properly

The most instructive moment was a production P0: asking the assistant a question white-screened the entire app. I didn't guess. I reproduced it, instrumented the console to capture the real (unminified) error, and traced it to its root: in current Chrome, `element.scrollIntoView({behavior:'smooth'})` returns a **Promise**, and an auto-scroll `useEffect` written as an expression-arrow was handing that Promise back to React as its cleanup function. On the next run React called it as `destroy()` → "destroy is not a function" → the app unmounted. The fix was one line (wrap the effect body so it returns nothing), plus an error boundary around the answer so no future render error can ever take the app down again. Methodical reproduction over guessing is the whole story of that fix.

I also had the agent produce a CTO-level architecture and reliability audit, and I verified its claims against the actual code rather than taking them at face value (one flagged "risk" turned out to be already enforced in code, so I corrected the report). Knowing the ceiling of your own architecture matters as much as the choices themselves.

---

## Phase 9 — Models and efficiency, chosen per step

Efficiency earns bonus points, so I routed deliberately: rules settle most filings before any model runs; a cheap model does bulk extraction; a stronger model is reserved for judgement and prose; embeddings do retrieval; everything is cached by content (24% of model calls served from cache). Ingestion and research run entirely on **Gemini's free tier**, so actual spend is zero. The one place I spent latency budget instead of money is the interactive assistant, which I moved to **Groq** because a product you reach for all day has to feel instant, with Gemini kept as the fallback. Every call is logged with model, tokens, latency and cost.

---

## How I used AI, honestly

I used the agent as a force multiplier, not a substitute for judgment. I set the thesis, the architecture, and the non-negotiable guardrails. I made every product and design call. I reviewed the agent's output, caught its drift (an AI-slop border here, a wrong claim in a report there, a redundant headline), and redirected it. I verified before I trusted: I had it reproduce bugs and prove fixes in a real browser rather than assert them. The agent made me dramatically faster; the thinking, the taste, and the decisions are mine.

## What I'd do next

- Read annual reports as well as transcripts, so capex, debt and segment promises can be *measured* in code, not only judged.
- Guidance-aware results alerts ("beat the revenue guide by 3 points") the instant results land, fusing the push and pull sides.
- Stream and parallelise the assistant for a sub-two-second first token.
- Drive the one hidden-material classifier error toward zero with a larger labelled set.
