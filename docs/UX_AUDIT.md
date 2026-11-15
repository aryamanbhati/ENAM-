# FINN — UX & Product Design Audit

**Review snapshot:** 15 November 2026, live application at `https://enam-six.vercel.app/?w=7d`, Chrome at a 390px mobile viewport. Findings below describe what was observed at that point in time; some were subsequently fixed during the build. Treat this as a dated design-review record, not a live issue tracker. Re-test the current deployment before assuming a finding remains open.

The review used browser reproduction, console inspection and DOM measurements rather than code-only inference. Contrast ratios were computed against the rendered backgrounds. The aim is to preserve the reasoning behind the design changes, not to imply that the original defects remain in the current app.

---

## A. Executive assessment

| Dimension | Score | One-line reason |
|---|---|---|
| Visual design | **7 / 10** | Strong, cohesive identity (off-white, ink, coral, pastels); let down by low-contrast text and headline truncation. |
| Usability | **4 / 10** | Core triage works, but the primary assistant feature **crashes the whole app**, and the 30d view breaks the mental model. |
| Information architecture | **6 / 10** | Needs you / Worth knowing / Routine is a genuinely good spine, undermined by duplicate cards and a count that doesn't scale. |
| Mobile experience | **7 / 10** | Properly mobile-first, no horizontal overflow, good floating dock; touch targets and truncation pull it down. |
| Accessibility | **4 / 10** | Six measured contrast failures, sub-44px targets, 9px labels. |
| Product clarity | **7 / 10** | Purpose is legible in under 10 seconds; "X things need you" is a great hook. |
| **Overall product quality** | **5.5 / 10** | A premium-leaning, opinionated product with a clear point of view, held back by one crashing feature and a cluster of fixable polish/accessibility defects. |

**The headline:** the design direction is good and the product thesis is clear. Two things stop it being demo-ready: (1) the Ask assistant throws a client-side exception and white-screens the app, and (2) the triage promise ("tell me what needs me") visibly collapses on the 30-day window where it reports **104 things need you**. Fix those two and FINN jumps from "promising prototype" to "credible product".

---

## B. Top 15 problems (ranked by impact)

| # | Problem | Location | Why it's a problem | Suggested solution | Severity |
|---|---|---|---|---|---|
| 1 | **Asking a question crashes the entire app** (white screen, `TypeError: u is not a function`). API returns valid JSON; the crash is in client render of the answer. | Ask bot → sheet, any screen | The flagship interaction is unusable and takes the whole page down with it. A demo-killer. | Wrap `AnswerView` render in an error boundary; fix the actual throw (see §C-Assistant). Never let one answer unmount the app. | **P0** |
| 2 | **30d shows "104 things need you"** | Today, `?w=30d` | Destroys the core philosophy. "Needs you" must be a small, actionable number. 104 is a backlog, not a triage list. | "Needs you" should always mean *unactioned, high-tier, recent*. On wide windows, cap it and reframe the rest as "earlier" or show a count of *new since you last looked*. | **P0** |
| 3 | **Headlines double-truncate into meaningless fragments**: "…Whole-time Director for one year from…" | Needs you cards + detail H2 | The cut happens mid-sentence at a date, so the user learns nothing from the end of the line. The *detail* view shows the same truncated title. | Cap on a clause boundary, not a hard char count; never end a title on "from…/of…/as…". Detail view must show the **full** untruncated sentence. | **P1** |
| 4 | **Six contrast failures** (WCAG AA needs 4.5:1 for body): "Start briefing" 2.82, "Listen" 2.93, "YOY" labels 2.58–2.77, "2d ago" 3.23. | Hero, stat tiles, card meta | Fails AA; the primary CTA label and the result-tile deltas are the worst offenders. Hard to read in sunlight. | Darken coral button text to pure white on a darker coral, or ink text; lift muted/faint tokens; move 9px uppercase labels to ≥11px at a darker tone. | **P1** |
| 5 | **Duplicate cards for one event** — Vodafone Idea net loss appears 3× in Worth knowing (net loss, Q2 revenue+loss, consolidated loss). | Today, Worth knowing | Pure noise; contradicts "hide what doesn't matter". Erodes trust that FINN de-duplicates. | De-dupe by (company, event-type, period); collapse multi-filing results into one card with sub-lines. | **P1** |
| 6 | **Two competing coral CTAs** — the hero "Start briefing" and the floating bot are both coral and both "the primary action". | Today + global | Coral is supposed to mean "the one thing to do". Two of them dilutes the signal. | Keep coral for the bot (assistant) OR the briefing, not both. Make "Start briefing" an ink/outline button; reserve coral for the bot. | **P1** |
| 7 | **Touch targets below 44px** — "Listen" 55×18, window tabs 93×31, bell is fine. | Hero, window picker | Apple/Android min is 44px; 18px tall is a mis-tap magnet. | Pad "Listen" to a 44px hit area; raise the segmented control to 40–44px tall. | **P1** |
| 8 | **"Last mentioned in Q4 FY26, silent since"** ends mid-sentence. | Research detail, promise cards | Reads like a bug; "silent since" dangles. | Finish the sentence: "silent since" → "silent for the last 3 calls". | **P2** |
| 9 | **Near-identical promise headlines** — "ROA guidance dropped in recent quarters", "ROE guidance dropped in recent quarters", "Gold loan portfolio guidance dropped in recent calls" stack three in a row. | Research detail | Visually repetitive; the eye can't tell them apart at a glance. | Lead with the *metric* ("Return on assets", "Return on equity") as the headline; make "quietly dropped" the status, not the sentence. | **P2** |
| 10 | **Hero number + text wrap awkwardly** — "7 things need / you." breaks after "need". | Today hero | The signature stat looks unresolved; "you." orphaned on its own line. | Tighten to one line at common widths, or set an explicit two-line composition ("7" big, "things need you" as a unit). | **P2** |
| 11 | **No visible focus states on cards / tabs** (only the default ring where present). | Global | Keyboard users can't see where they are; fails 2.4.7. | Add a visible `:focus-visible` ring on cards, tabs, chips and the bot. | **P1** (a11y) |
| 12 | **9px uppercase micro-labels** ("YOY", tile foots). | Stat tiles, metrics panel | Below legible size on mobile; combined with low contrast (#4) they're unreadable. | Floor label size at 11px; drop all-caps or add letter-spacing + weight. | **P2** |
| 13 | **Briefing nav overlaps the "Ask next" chips** — Next/Previous buttons sit on top of the suggested-question chips at the bottom of the detail stack. | Briefing detail stack | Controls collide; a tap can hit the wrong target. | Give the chip block bottom padding equal to the nav row; or move Next/Prev into a fixed footer bar. | **P1** |
| 14 | **"Listen" silently does nothing premium** — falls back to the robotic browser voice because the OpenAI TTS account has no credits. | Hero | The feature *looks* available but delivers the exact robotic voice it was meant to replace. No affordance tells the user why. | Add credits (or swap provider); until then, show the control only when a real voice is available, or label the fallback. | **P1** (functional) |
| 15 | **Assistant is slow (~14–18s)** even on Groq. | Ask | Long enough that users assume it hung (and it did, see #1). | Parallelise router/filings/market agents; merge composer+verifier; stream tokens so first words appear in <2s. | **P2** |

---

## C. Component-by-component redesign

### Hero / "things need you" card
- **Wrong:** CTA label fails contrast (2.82:1); number + copy wrap badly; two coral CTAs; "Listen" is an 18px target that plays a robot voice.
- **Change:** white text on a darker coral (or ink label); compose the stat as a deliberate two-line lockup; demote "Start briefing" to ink, keep the bot coral; give "Listen" a 44px hit area and a real voice.
- **Keep:** the ink field, the coral count, the three-segment distribution bar + legend (this is genuinely good and premium).
- **Why:** the hero is the first thing seen; it must pass contrast and present *one* obvious action.

### News card (Needs you)
- **Wrong:** headline truncates to "…from…"; avatar + name + category + time + headline + person sub-card is a lot of stacked rows.
- **Change:** truncate on a clause; keep the two-line headline but guarantee the first clause survives; the person sub-card is good — keep it but only for management changes.
- **Keep:** the "VI/HB" initials avatar, the category chip, the clear time stamp. The anatomy is right.
- **Typography:** headline 17–18px / 1.3, semibold; meta 11–12px at a darker muted; never 9px.

### Worth knowing list
- **Wrong:** duplicates (3× Vodafone Idea); divider rows are lighter-weight than Needs-you cards, which is correct, but the dedupe failure makes it look padded.
- **Change:** collapse same-event filings; show one row with a "+2 related filings" affordance.
- **Keep:** the compact divider-row pattern — it's the right density for secondary items.

### Result metrics (the 4 tiles: Revenue/EBITDA/PBT/PAT)
- **Wrong:** "YOY" labels at 9px fail contrast on all three tints (2.58–2.77); value/label hierarchy is flat.
- **Change:** 11px label minimum, darker tone; make the % the hero of each tile, "YoY" a quiet suffix.
- **Keep:** the green/red tinted backgrounds mapping to direction — that's meaning-carrying colour done right.

### Research "The numbers" panel (new)
- **Wrong:** nothing major — this is the strongest new component. Minor: axis micro-labels are tiny.
- **Change:** bump the quarter labels to 10–11px; add a hover/tap readout on the bars.
- **Keep:** the whole thing. Revenue bars + margin line + director-changes count is exactly the "more than promises" depth the product needs.

### Promise cards
- **Wrong:** three stacked "…guidance dropped in recent quarters/calls" headlines read identically; "silent since" dangles.
- **Change:** metric-first headline, status as chip; finish sentences.
- **Keep:** the status chip + "Show the quarter-by-quarter record" disclosure. Good progressive disclosure.

### Time filters (segmented control)
- **Wrong:** 31px tall (sub-44); the sliding thumb is nice but the control is thin.
- **Change:** 40–44px tall; keep the sliding thumb.
- **Keep:** the slide animation and the inclusion of Custom.

### Floating bot / Ask
- **Wrong:** it crashes the app (#1); competes with the hero CTA for coral.
- **Change:** fix the render crash + error boundary; stream the answer; keep coral *here* and nowhere else.
- **Keep:** the bottom-right placement, the scope-aware greeting ("Hi, I'm FINN"), the pulse-on-scope-change. The pattern is right; the reliability isn't.

### Navigation dock
- **Wrong:** nothing major — this is clean now (ink capsule active tab, icon-only inactive).
- **Keep:** as is. Good mobile-native pattern.

---

## D. Quick wins

**Under 1 hour**
- Darken coral-button and "Listen" text to pass AA (#4).
- Floor all 9px labels at 11px, darker tone (#12).
- Finish the "silent since" sentence (#8).
- Add bottom padding so briefing nav clears the chips (#13).
- Make "Start briefing" ink, leaving coral to the bot (#6).

**Under 1 day**
- Wrap the Ask answer in an error boundary so a bad answer never white-screens the app (#1, mitigation).
- Fix headline truncation to cut on a clause and show full text in detail (#3).
- De-dupe Worth knowing by (company, event, period) (#5).
- Raise segmented control + Listen to 44px targets (#7).
- Add visible focus rings (#11).

**Under 3 days**
- Root-cause and fix the Ask render crash (#1).
- Rework the "Needs you" count so it stays small and meaningful across windows (#2).
- Metric-first promise headlines + de-dupe (#9).
- Parallelise/stream the assistant for sub-5s first token (#15).

---

## E. Design system (consolidated from what's shipped, with fixes)

**Type scale (one family — Geist, already in place):**
`12 · 13 · 15 · 17 · 22 · 28 · 40 · 56`. Body min 15px; micro-labels min 11px (never 9). Headlines 17–28 semibold, -0.02em. All figures `tabular-nums`.

**Colour (keep the identity, fix contrast):**
- Page `#f7f5f2`, surface `#ffffff`, raised `#f0ede8`, line `#e5e1d8`.
- Ink `#101420`, muted → darken to ~`#4c5262` (from `#5a6072`) for AA, faint only for ≥18px.
- Coral `#ff6b4a` — reserve for the single primary action; button text pure white on a coral darkened to ~`#e85636` to clear 4.5:1.
- Pastels: lavender `#ece4f7`/ink `#4a3b7a`, peach `#ffe4d6`/ink `#8a3d1b`.
- Up `#1c7c54` / Down `#c8372d` — keep, only ever meaning direction.

**Spacing:** 4px base (4/8/12/16/20/24/28/32/40). Card padding 20, row padding 16, section gap 28 — already tokenised, keep.

**Radius:** sm 10 (chips), md 14 (inputs/tiles), lg 22 (cards), xl 28 (hero). Keep.

**Shadows:** two levels (soft, low) — keep; don't add more.

**Cards:** one surface, one hairline, one soft shadow, 20px padding, lg radius. No nested cards deeper than one level.

**Badges/chips:** one `.chip` anatomy (24px min height, 6px dot, 11.5px, semibold). Status = dot colour; never two chip shapes.

**Buttons:** primary = coral (one per screen, AA text); secondary = ink; tertiary = outline. All ≥44px tall.

**Breakpoints:** single centred column, 390 → 768 → 1280; never stretch the column on desktop (currently correct).

---

## F. Prioritised action plan

**P0 — critical (do before any demo)**
1. Fix the Ask crash + add an error boundary. *Impact: restores the flagship feature; prevents total app failure.*
2. Make "Needs you" stay a small, meaningful number across windows. *Impact: saves the core product promise.*

**P1 — high-impact UX/visual**
3. Headline truncation on clause boundaries + full title in detail. *Impact: every card becomes scannable.*
4. Fix the six contrast failures. *Impact: readable in real light; AA baseline.*
5. De-dupe Worth knowing. *Impact: restores "we hide the noise" trust.*
6. One coral CTA; 44px targets; focus rings; briefing-nav overlap. *Impact: premium feel + accessibility.*
7. Real Listen voice (credits or provider swap) or hide the control. *Impact: feature delivers what it promises.*

**P2 — polish**
8. Metric-first promise headlines; finish dangling sentences.
9. 11px label floor; larger chart axis labels.
10. Stream + parallelise the assistant for sub-5s first token.

---

### What's genuinely strong (keep, don't touch)
- The **Needs you / Worth knowing / Routine** spine and the "X things need you" hook — a real, defensible product idea.
- The **"The numbers"** research panel (revenue bars + margin line + director count) — this is the depth that separates FINN from a news reader.
- The **detail stack** flow (swipe through items, "Why this is here", "For you", cited key points, "You're caught up") — a coherent, opinionated reading experience.
- The **palette and one-font discipline** — cohesive and premium once contrast is fixed.
- The **dock** and **de-cluttered header** — clean and mobile-native.
