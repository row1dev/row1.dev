-- champagne.row1.dev — schema
-- Draai dit in de Supabase SQL editor van je project.

create extension if not exists "pgcrypto";

create table if not exists public.tastings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,
  user_name   text        not null,
  name        text        not null,
  score       numeric(3,1) not null,
  photo_url   text        not null,
  note        text,
  created_at  timestamptz not null default now(),

  -- Naam is precies één woord.
  constraint tastings_name_one_word check (name ~ '^\S+$'),
  -- Cijfer tussen 0,0 en 10,0 en nooit precies 8,5.
  constraint tastings_score_range check (score >= 0 and score <= 10),
  constraint tastings_score_not_85 check (score <> 8.5)
);

create index if not exists tastings_user_created_idx
  on public.tastings (user_id, created_at desc);

create index if not exists tastings_created_idx
  on public.tastings (created_at desc);

-- De app praat alleen server-side met Supabase, met de service role key.
-- RLS staat aan zonder policies: anon en authenticated komen er niet in,
-- de service role omzeilt RLS.
alter table public.tastings enable row level security;

-- Publieke bucket voor de foto's.
insert into storage.buckets (id, name, public)
values ('champagne-photos', 'champagne-photos', true)
on conflict (id) do update set public = true;
