-- Trading Analytics v1 · schema dati condiviso (partite) e dati personali.
-- Tutte le tabelle hanno prefisso ta_ per convivere con le altre app del progetto.

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Campionati
-- ---------------------------------------------------------------------------
create table if not exists public.ta_leagues (
  code          text primary key,              -- es. 'I1'
  name          text not null unique,          -- es. 'Serie A'
  country       text not null,                 -- es. 'ITA' ('UEFA' per le coppe europee)
  country_name  text not null,                 -- es. 'Italia'
  tier          smallint not null default 1,
  fd_kind       text check (fd_kind in ('main','extra')),  -- football-data.co.uk
  fd_code       text,
  om_folder     text,                          -- cartella Open Matchday
  multi_meeting boolean not null default false,-- la stessa coppia casa/trasferta può ripetersi nella stagione
  sort          smallint not null default 100,
  active        boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Squadre e alias
-- ---------------------------------------------------------------------------
create table if not exists public.ta_teams (
  id         serial primary key,
  country    text not null,
  name       text not null,
  status     text not null default 'ok' check (status in ('ok','nuova','da_verificare')),
  created_at timestamptz not null default now(),
  unique (country, name)
);

-- Nome normalizzato: minuscolo, senza accenti/punteggiatura e senza sigle societarie.
create or replace function public.ta_norm(p text) returns text
language sql immutable parallel safe
set search_path = ''
as $$
  select coalesce(string_agg(tok, ' ' order by ord), '')
  from unnest(regexp_split_to_array(
         trim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p,''))), '[^a-z0-9]+', ' ', 'g')),
         '\s+')) with ordinality as t(tok, ord)
  where tok <> '' and tok not in ('fc','cf','ac','afc','sc','ssc','us','as','cd','ud','sd','rc','rcd','fk','nk','hnk','bk','sk','sv','vfb','vfl','tsg','calcio','club','de','del','la','le','1');
$$;

create index if not exists ta_teams_norm_idx on public.ta_teams (country, public.ta_norm(name));

create table if not exists public.ta_team_aliases (
  scope        text not null,     -- paese del campionato di provenienza, o 'UEFA'
  alias_norm   text not null,
  alias        text not null,
  team_country text not null,
  team_name    text not null,
  note         text,
  primary key (scope, alias_norm)
);

-- ---------------------------------------------------------------------------
-- Partite
-- ---------------------------------------------------------------------------
create table if not exists public.ta_matches (
  id          bigserial primary key,
  league      text not null references public.ta_leagues(code),
  season      text not null,                 -- '2026/27'
  match_date  date not null,                 -- data locale della partita
  kickoff     timestamptz,                   -- calcio d'inizio in UTC (null se ignoto)
  home_id     int not null references public.ta_teams(id),
  away_id     int not null references public.ta_teams(id),
  status      text not null default 'scheduled' check (status in ('scheduled','finished')),
  fthg smallint, ftag smallint, hthg smallint, htag smallint,
  -- statistiche (tiri, tiri in porta, falli, corner, gialli, rossi)
  sh_h smallint, sh_a smallint, sot_h smallint, sot_a smallint, fo_h smallint, fo_a smallint,
  co_h smallint, co_a smallint, ye_h smallint, ye_a smallint, re_h smallint, re_a smallint,
  -- quote pre-partita (media bookmaker, in mancanza Bet365) e di chiusura
  o_h numeric(6,2), o_d numeric(6,2), o_a numeric(6,2), o_o25 numeric(6,2), o_u25 numeric(6,2),
  c_h numeric(6,2), c_d numeric(6,2), c_a numeric(6,2), c_o25 numeric(6,2), c_u25 numeric(6,2),
  -- Betfair Exchange alla chiusura (dove disponibile)
  bf_h numeric(7,2), bf_d numeric(7,2), bf_a numeric(7,2),
  src_result  text,
  src_fixture text,
  updated_at  timestamptz not null default now(),
  check (home_id <> away_id)
);
create index if not exists ta_matches_pair_idx on public.ta_matches (league, season, home_id, away_id);
create index if not exists ta_matches_season_idx on public.ta_matches (season, updated_at);
create index if not exists ta_matches_date_idx on public.ta_matches (match_date);
create index if not exists ta_matches_away_idx on public.ta_matches (away_id);
create index if not exists ta_matches_home_idx on public.ta_matches (home_id);

-- Eventi gol (predisposta, nessuna fonte collegata per ora)
create table if not exists public.ta_goal_events (
  match_id bigint not null references public.ta_matches(id) on delete cascade,
  minute   smallint not null,
  extra    smallint,
  side     char(1) not null check (side in ('H','A')),
  kind     text not null default 'goal' check (kind in ('goal','own','pen')),
  player   text,
  source   text
);
create index if not exists ta_goal_events_match_idx on public.ta_goal_events (match_id);

-- Registro sincronizzazioni
create table if not exists public.ta_sync_runs (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  league      text,
  season      text,
  source      text,
  kind        text,
  ok          boolean not null,
  rows_in     int,
  inserted    int,
  updated     int,
  removed     int,
  message     text
);

create table if not exists public.ta_meta (
  key   text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Dati personali (trade, quote, previsioni, note…): visibili solo al proprietario
-- ---------------------------------------------------------------------------
create table if not exists public.ta_user_data (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

-- ---------------------------------------------------------------------------
-- Sicurezza: dati calcistici in sola lettura per tutti, scritture solo lato server.
-- ---------------------------------------------------------------------------
alter table public.ta_leagues      enable row level security;
alter table public.ta_teams        enable row level security;
alter table public.ta_team_aliases enable row level security;
alter table public.ta_matches      enable row level security;
alter table public.ta_goal_events  enable row level security;
alter table public.ta_sync_runs    enable row level security;
alter table public.ta_meta         enable row level security;
alter table public.ta_user_data   enable row level security;

create policy ta_leagues_read      on public.ta_leagues      for select to anon, authenticated using (true);
create policy ta_teams_read        on public.ta_teams        for select to anon, authenticated using (true);
create policy ta_team_aliases_read on public.ta_team_aliases for select to anon, authenticated using (true);
create policy ta_matches_read      on public.ta_matches      for select to anon, authenticated using (true);
create policy ta_goal_events_read  on public.ta_goal_events  for select to anon, authenticated using (true);
create policy ta_sync_runs_read    on public.ta_sync_runs    for select to anon, authenticated using (true);
create policy ta_meta_read         on public.ta_meta         for select to anon, authenticated using (true);

create policy ta_user_data_select on public.ta_user_data for select to authenticated using ((select auth.uid()) = user_id);
create policy ta_user_data_insert on public.ta_user_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy ta_user_data_update on public.ta_user_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy ta_user_data_delete on public.ta_user_data for delete to authenticated using ((select auth.uid()) = user_id);
