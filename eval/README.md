# Evaluation

Run from `worker/`:

```bash
.venv/Scripts/python -m finn_worker.cli eval all
```

Each run writes `eval/results/<name>.json`.

| Eval | What it measures | Ground truth |
|---|---|---|
| `classifier` | Material vs routine, for the rules tier alone and for the final tier (rules + cheap model); errors split into upward (routine shown) and downward (material hidden) | `classifier_labels.csv`: 99 real filings (stratified by BSE subcategory, extra weight on the vague "General" bucket), labelled by the developer using the reference document's categories. One unclear filing excluded. |
| `results` | Revenue, PBT and PAT copied from results PDFs vs screener's quarterly table, within 1% | screener.in (independent of our PDF extraction) |
| `promises` | Share of model-extracted quotes that match their cited transcript page; verdict mix per company | The transcript text itself |
| `cost` | Calls, tokens, cache hits and list-price cost per pipeline step and per research run | `llm_calls` table |

## Honest limits

- Classifier labels were written by the developer, not an independent analyst. The rules were not tuned on this set after labelling.
- Promise precision and recall need hand-labelled promises. The quote verification rate measures faithfulness (no invented quotes), not completeness.
- Results comparison treats a basis mismatch (standalone vs consolidated) as a miss, so the number is a lower bound.
