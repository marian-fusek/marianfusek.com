-- Fantasheee: shared six-team state, no accounts/auth by design.
-- Run this entire file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.fantasheee_teams (
  id text primary key,
  name text not null,
  abbr text not null,
  logo text default '',
  wins integer not null default 0,
  losses integer not null default 0,
  waiver_priority integer not null unique
);

create table if not exists public.fantasheee_roster (
  team_id text not null references public.fantasheee_teams(id) on delete cascade,
  player_id text not null,
  acquired_at timestamptz not null default now(),
  primary key(team_id,player_id),
  unique(player_id)
);

create table if not exists public.fantasheee_lineups (
  team_id text not null references public.fantasheee_teams(id) on delete cascade,
  player_id text not null,
  week integer not null,
  slot text not null default 'BE',
  updated_at timestamptz not null default now(),
  primary key(team_id,player_id,week)
);

create table if not exists public.fantasheee_matchups (
  week integer not null,
  team_a text not null references public.fantasheee_teams(id),
  team_b text not null references public.fantasheee_teams(id),
  primary key(week,team_a),
  check(team_a <> team_b)
);

create table if not exists public.fantasheee_waiver_claims (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.fantasheee_teams(id),
  add_player_id text not null,
  drop_player_id text,
  week integer not null,
  status text not null default 'pending' check(status in ('pending','won','lost','cancelled')),
  process_at timestamptz not null default (date_trunc('day', now()) + interval '1 day' + interval '9 hour'),
  created_at timestamptz not null default now()
);

create table if not exists public.fantasheee_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  team_id text not null references public.fantasheee_teams(id),
  add_player_id text,
  drop_player_id text,
  week integer not null,
  created_at timestamptz not null default now()
);

insert into public.fantasheee_teams(id,name,abbr,waiver_priority) values
('team-1','Team 1','T1',1),('team-2','Team 2','T2',2),('team-3','Team 3','T3',3),
('team-4','Team 4','T4',4),('team-5','Team 5','T5',5),('team-6','Team 6','T6',6)
on conflict(id) do nothing;

-- Example Week 2 matchups. Change these rows to your real schedule.
insert into public.fantasheee_matchups(week,team_a,team_b) values
(2,'team-1','team-2'),(2,'team-3','team-4'),(2,'team-5','team-6')
on conflict do nothing;

create or replace function public.fantasheee_add_free_agent(
  p_team_id text, p_add_player_id text, p_drop_player_id text, p_week integer
) returns void language plpgsql security definer as $$
begin
  if exists(select 1 from public.fantasheee_roster where player_id=p_add_player_id) then
    raise exception 'Player is already owned';
  end if;
  if p_drop_player_id is null and (select count(*) from public.fantasheee_roster where team_id=p_team_id) >= 16 then
    raise exception 'Choose a player to drop before adding this player';
  end if;
  if p_drop_player_id is not null then
    if not exists(select 1 from public.fantasheee_roster where team_id=p_team_id and player_id=p_drop_player_id) then
      raise exception 'Drop player is not on this roster';
    end if;
    delete from public.fantasheee_roster where team_id=p_team_id and player_id=p_drop_player_id;
    delete from public.fantasheee_lineups where team_id=p_team_id and player_id=p_drop_player_id and week=p_week;
  end if;
  insert into public.fantasheee_roster(team_id,player_id) values(p_team_id,p_add_player_id);
  insert into public.fantasheee_lineups(team_id,player_id,week,slot) values(p_team_id,p_add_player_id,p_week,'BE')
    on conflict(team_id,player_id,week) do update set slot='BE',updated_at=now();
  insert into public.fantasheee_transactions(type,team_id,add_player_id,drop_player_id,week)
    values('add_drop',p_team_id,p_add_player_id,p_drop_player_id,p_week);
end $$;

create or replace function public.fantasheee_drop_player(
  p_team_id text, p_player_id text, p_week integer
) returns void language plpgsql security definer as $$
begin
  if not exists(select 1 from public.fantasheee_roster where team_id=p_team_id and player_id=p_player_id) then
    raise exception 'Player is not on this roster';
  end if;
  delete from public.fantasheee_roster where team_id=p_team_id and player_id=p_player_id;
  delete from public.fantasheee_lineups where team_id=p_team_id and player_id=p_player_id and week=p_week;
  insert into public.fantasheee_transactions(type,team_id,drop_player_id,week)
    values('drop',p_team_id,p_player_id,p_week);
end $$;

create or replace function public.fantasheee_move_player(
  p_team_id text, p_player_id text, p_slot text, p_week integer
) returns void language plpgsql security definer as $$
declare current_slot text; occupied_player text; slot_capacity integer; bench_count integer;
begin
  if p_slot not in ('QB','RB','WR','TE','FLEX','K','DEF','BE','IR') then
    raise exception 'That lineup slot is not available';
  end if;
  if not exists(select 1 from public.fantasheee_roster where team_id=p_team_id and player_id=p_player_id) then
    raise exception 'Player is not on this roster';
  end if;
  slot_capacity := case p_slot when 'RB' then 2 when 'WR' then 2 when 'BE' then 6 else 1 end;
  select coalesce(slot,'BE') into current_slot
    from public.fantasheee_lineups where team_id=p_team_id and player_id=p_player_id and week=p_week;
  if coalesce(current_slot,'BE') = p_slot then return; end if;
  select count(*) into bench_count from public.fantasheee_lineups
    where team_id=p_team_id and week=p_week and slot='BE' and player_id<>p_player_id;
  if p_slot='BE' and bench_count >= slot_capacity then
    raise exception 'No bench slot is available for this move';
  end if;
  if p_slot<>'BE' and (select count(*) from public.fantasheee_lineups
      where team_id=p_team_id and week=p_week and slot=p_slot and player_id<>p_player_id) >= slot_capacity then
    if bench_count >= 6 then raise exception 'No bench slot is available for this move'; end if;
    select player_id into occupied_player from public.fantasheee_lineups
      where team_id=p_team_id and week=p_week and slot=p_slot and player_id<>p_player_id limit 1;
    update public.fantasheee_lineups set slot='BE', updated_at=now()
      where team_id=p_team_id and player_id=occupied_player and week=p_week;
  end if;
  insert into public.fantasheee_lineups(team_id,player_id,week,slot) values(p_team_id,p_player_id,p_week,p_slot)
    on conflict(team_id,player_id,week) do update set slot=excluded.slot,updated_at=now();
end $$;

-- Opportunistic rolling waivers: any open app can call this safely.
create or replace function public.fantasheee_process_due_waivers() returns void language plpgsql security definer as $$
declare c record; current_owner text; max_priority integer;
begin
  perform pg_advisory_xact_lock(hashtext('fantasheee:waiver-run'));
  for c in
    select wc.* from public.fantasheee_waiver_claims wc
    join public.fantasheee_teams t on t.id=wc.team_id
    where wc.status='pending' and wc.process_at<=now()
    order by wc.add_player_id, t.waiver_priority asc, wc.created_at asc
  loop
    select team_id into current_owner from public.fantasheee_roster where player_id=c.add_player_id limit 1;
    if current_owner is null then
      if c.drop_player_id is not null and not exists(select 1 from public.fantasheee_roster where team_id=c.team_id and player_id=c.drop_player_id) then
        update public.fantasheee_waiver_claims set status='lost' where id=c.id;
        continue;
      end if;
      if c.drop_player_id is null and (select count(*) from public.fantasheee_roster where team_id=c.team_id) >= 16 then
        update public.fantasheee_waiver_claims set status='lost' where id=c.id;
        continue;
      end if;
      if c.drop_player_id is not null then
        delete from public.fantasheee_roster where team_id=c.team_id and player_id=c.drop_player_id;
        delete from public.fantasheee_lineups where team_id=c.team_id and player_id=c.drop_player_id and week=c.week;
      end if;
      insert into public.fantasheee_roster(team_id,player_id) values(c.team_id,c.add_player_id) on conflict do nothing;
      insert into public.fantasheee_lineups(team_id,player_id,week,slot) values(c.team_id,c.add_player_id,c.week,'BE') on conflict do nothing;
      update public.fantasheee_waiver_claims set status='won' where id=c.id;
      update public.fantasheee_waiver_claims set status='lost' where status='pending' and add_player_id=c.add_player_id and week=c.week and id<>c.id;
      insert into public.fantasheee_transactions(type,team_id,add_player_id,drop_player_id,week) values('waiver',c.team_id,c.add_player_id,c.drop_player_id,c.week);
      select max(waiver_priority) into max_priority from public.fantasheee_teams;
      update public.fantasheee_teams set waiver_priority=waiver_priority-1 where waiver_priority>(select waiver_priority from public.fantasheee_teams where id=c.team_id);
      update public.fantasheee_teams set waiver_priority=max_priority where id=c.team_id;
    else
      update public.fantasheee_waiver_claims set status='lost' where id=c.id;
    end if;
  end loop;
end $$;

alter table public.fantasheee_teams enable row level security;
alter table public.fantasheee_roster enable row level security;
alter table public.fantasheee_lineups enable row level security;
alter table public.fantasheee_matchups enable row level security;
alter table public.fantasheee_waiver_claims enable row level security;
alter table public.fantasheee_transactions enable row level security;

-- Trust-based private league: everyone with the site can read/write. There is intentionally no login.
do $$ begin
  create policy "fantasheee teams open" on public.fantasheee_teams for all to anon using(true) with check(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "fantasheee roster open" on public.fantasheee_roster for all to anon using(true) with check(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "fantasheee lineups open" on public.fantasheee_lineups for all to anon using(true) with check(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "fantasheee matchups open" on public.fantasheee_matchups for all to anon using(true) with check(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "fantasheee claims open" on public.fantasheee_waiver_claims for all to anon using(true) with check(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "fantasheee transactions open" on public.fantasheee_transactions for all to anon using(true) with check(true);
exception when duplicate_object then null; end $$;

grant usage on schema public to anon;
grant select,insert,update,delete on all tables in schema public to anon;
grant execute on function public.fantasheee_add_free_agent(text,text,text,integer) to anon;
grant execute on function public.fantasheee_drop_player(text,text,integer) to anon;
grant execute on function public.fantasheee_move_player(text,text,text,integer) to anon;
grant execute on function public.fantasheee_process_due_waivers() to anon;
