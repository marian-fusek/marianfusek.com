create table if not exists public.wn_state (
  league_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.wn_state enable row level security;

create policy "public private-league read"
on public.wn_state for select
using (true);

create policy "public private-league insert"
on public.wn_state for insert
with check (true);

create policy "public private-league update"
on public.wn_state for update
using (true)
with check (true);

alter table public.wn_state replica identity full;
alter publication supabase_realtime add table public.wn_state;
