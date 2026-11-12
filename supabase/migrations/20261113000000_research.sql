-- Research pipeline, hybrid retrieval, enrichment and assistant support.

-- Embeddings: gemini-embedding-001 at 768 dimensions (same model at index and query time).
alter table chunks alter column embedding type vector(768);
create index if not exists chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);

-- Hybrid search over one company's primary documents: full-text + vector, fused by reciprocal rank.
create or replace function match_chunks(
  p_company_id bigint, p_query_embedding vector(768), p_query_text text, p_k int default 8
) returns table (chunk_id bigint, document_id bigint, page int, text text, doc_type text, period text, url text, score float)
language sql stable as $$
  with docs as (select id, type, period, url from documents where company_id = p_company_id),
  vec as (
    select c.id, row_number() over (order by c.embedding <=> p_query_embedding) as r
    from chunks c join docs d on d.id = c.document_id
    where c.embedding is not null
    order by c.embedding <=> p_query_embedding limit 40
  ),
  fts as (
    select c.id, row_number() over (order by ts_rank(c.tsv, q) desc) as r
    from chunks c join docs d on d.id = c.document_id, websearch_to_tsquery('english', p_query_text) q
    where c.tsv @@ q
    order by ts_rank(c.tsv, q) desc limit 40
  ),
  fused as (
    select id, sum(1.0 / (60 + r)) as score from (select * from vec union all select * from fts) u group by id
  )
  select c.id, c.document_id, c.page, c.text, d.type, d.period, d.url, f.score
  from fused f join chunks c on c.id = f.id join docs d on d.id = c.document_id
  order by f.score desc limit p_k;
$$;

-- Promise detail for the research page.
alter table promises
  add column if not exists category text,                  -- revenue_growth, margin, profit_growth, capex, volume, other
  add column if not exists first_period text,
  add column if not exists last_period text,
  add column if not exists status_line text,               -- e.g. 'Guided 15% growth, tracking 9%'
  add column if not exists detail jsonb,                   -- computed actuals, per-period numbers, method
  add column if not exists thread_key text;
create unique index if not exists promises_thread_idx on promises (company_id, thread_key);

-- One row per researched company: state, document set fingerprint, generated header and questions.
create table if not exists research (
  company_id      bigint primary key references companies(id) on delete cascade,
  status          text not null default 'none' check (status in ('none','running','ready','failed','no_guidance')),
  doc_set_hash    text,
  snapshot        jsonb,      -- one-liner with page ref, headline numbers (from facts)
  scorecard       jsonb,
  questions       jsonb,      -- suggested questions with cached answers
  transcripts     int,
  results_filings int,
  updated_at      timestamptz not null default now()
);

-- Assistant answers cached per scope + question.
create table if not exists qa_cache (
  key         text primary key,
  scope       text not null,
  question    text not null,
  answer      jsonb not null,
  created_at  timestamptz not null default now()
);

alter table filings add column if not exists needs_llm boolean not null default false;
alter table filings add column if not exists pdf_hash text;

alter table research enable row level security;
create policy research_read on research for select to anon, authenticated using (true);
alter table qa_cache enable row level security;
alter table llm_calls enable row level security;
create policy llm_calls_read on llm_calls for select to anon, authenticated using (true);

alter publication supabase_realtime add table research;
