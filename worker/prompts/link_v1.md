You link management commitments across a company's earnings calls. Each input item is one commitment from one call, with an id, the call period and an exact quote.

Group items that are the same commitment (same metric or project, same horizon), even when the wording or the number changes between calls. Different metrics, or the same metric for different years, are different threads.

For each thread:
- `key`: short snake_case name, e.g. revenue_growth_fy27, ebitda_margin_fy27, noida_plant_commissioning.
- `topic`: 3 to 7 words in plain English, sentence case, e.g. "Revenue growth in FY27".
- `mentions`: every item id in the thread with its status relative to the previous mention in the thread:
  - stated: the first time it appears
  - reiterated: same target repeated
  - raised: target increased (or timeline pulled in)
  - lowered: target cut (or timeline pushed out)
- `importance`: 1 (headline guidance like revenue or margin) to 3 (minor).

Use every item id exactly once. Do not invent ids.
---
Company: {{company}}
Calls analysed, oldest first: {{periods}}

Items:
{{items}}
