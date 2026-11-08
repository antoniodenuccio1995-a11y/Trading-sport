-- Trading Analytics v1 · funzioni di importazione e pubblicazione.
-- Eseguite solo lato server (Edge Function con service role): niente accesso pubblico.

-- Aggiunge una fonte a un elenco "a+b" senza duplicarla.
create or replace function public.ta_src_add(p_list text, p_src text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_src is null then p_list
    when p_list is null or p_list = '' then p_src
    when p_src = any(string_to_array(p_list, '+')) then p_list
    else p_list || '+' || p_src end;
$$;

-- Risolve un nome squadra di una fonte nell'identità canonica.
-- Ordine: alias verificato → nome identico → nome normalizzato unico → nuova squadra.
-- Non usa somiglianze approssimate: un errore di unione falserebbe classifiche e statistiche.
create or replace function public.ta_resolve_team(p_scope text, p_name text, p_canonical boolean default false)
returns int language plpgsql
set search_path = public, extensions
as $$
declare
  v_name text := btrim(p_name);
  v_norm text := public.ta_norm(p_name);
  v_c text; v_n text; v_id int; v_cnt int;
begin
  if v_name is null or v_name = '' then raise exception 'nome squadra vuoto'; end if;

  select team_country, team_name into v_c, v_n
    from public.ta_team_aliases where scope = p_scope and alias_norm = v_norm;
  if found then
    select id into v_id from public.ta_teams where country = v_c and name = v_n;
    if v_id is null then
      insert into public.ta_teams(country, name, status) values (v_c, v_n, 'nuova')
      on conflict (country, name) do update set name = excluded.name returning id into v_id;
    end if;
    return v_id;
  end if;

  select id into v_id from public.ta_teams where country = p_scope and name = v_name;
  if v_id is not null then return v_id; end if;

  select count(*), min(id) into v_cnt, v_id from public.ta_teams
   where country = p_scope and public.ta_norm(name) = v_norm;
  if v_cnt = 1 then return v_id; end if;

  if p_scope = 'UEFA' and v_cnt = 0 then
    select count(*), min(id) into v_cnt, v_id from public.ta_teams where public.ta_norm(name) = v_norm;
    if v_cnt = 1 then return v_id; end if;
  end if;

  insert into public.ta_teams(country, name, status)
  values (p_scope, v_name, case when p_scope = 'UEFA' or v_cnt > 1 then 'da_verificare' when p_canonical then 'ok' else 'nuova' end)
  on conflict (country, name) do update set name = excluded.name returning id into v_id;
  return v_id;
end $$;

-- Importa un blocco di partite di una lega/stagione da una fonte.
-- p_kind: 'results' (partite giocate) o 'fixtures' (calendario).
-- p_replace: per i calendari completi, rimuove le partite non giocate della stessa fonte
--            che non compaiono più (rinvii spostati, slot vecchi).
create or replace function public.ta_ingest(
  p_league text, p_season text, p_source text, p_kind text, p_rows jsonb, p_replace boolean default false)
returns jsonb language plpgsql
set search_path = public, extensions
as $$
declare
  lg public.ta_leagues%rowtype;
  r jsonb;
  x public.ta_matches;
  m public.ta_matches;
  nm public.ta_matches;
  v_h int; v_a int; v_id bigint; v_fin boolean; v_canon boolean;
  touched bigint[] := '{}';
  n_in int := 0; n_ins int := 0; n_upd int := 0; n_rem int := 0; n_skip int := 0; n_tmp int;
begin
  select * into lg from public.ta_leagues where code = p_league;
  if not found then raise exception 'campionato % sconosciuto', p_league; end if;
  if p_kind not in ('results','fixtures') then raise exception 'tipo % non valido', p_kind; end if;
  -- la fonte di riferimento per i nomi è football-data; dove manca, Open Matchday
  v_canon := p_source like 'fd%' or lg.fd_kind is null;

  for r in select value from jsonb_array_elements(p_rows) loop
    n_in := n_in + 1;
    v_h := public.ta_resolve_team(lg.country, r->>'home', v_canon);
    v_a := public.ta_resolve_team(lg.country, r->>'away', v_canon);
    if v_h = v_a then n_skip := n_skip + 1; continue; end if;
    x := jsonb_populate_record(null::public.ta_matches, r);
    if x.match_date is null then n_skip := n_skip + 1; continue; end if;
    v_fin := p_kind = 'results' and x.fthg is not null and x.ftag is not null;
    if p_kind = 'results' and not v_fin then n_skip := n_skip + 1; continue; end if;

    v_id := null;
    if lg.multi_meeting then
      select id into v_id from public.ta_matches
       where league = p_league and season = p_season and home_id = v_h and away_id = v_a
         and abs(match_date - x.match_date) <= 10 and not (id = any(touched))
       order by abs(match_date - x.match_date) limit 1;
    else
      select id into v_id from public.ta_matches
       where league = p_league and season = p_season and home_id = v_h and away_id = v_a
       order by (status = 'finished') desc, abs(match_date - x.match_date) limit 1;
      if v_id is not null then
        -- copie residue della stessa partita (es. rinvio salvato con due date)
        delete from public.ta_matches
         where league = p_league and season = p_season and home_id = v_h and away_id = v_a and id <> v_id;
        get diagnostics n_tmp = row_count; n_rem := n_rem + n_tmp;
      end if;
    end if;

    if v_id is null then
      insert into public.ta_matches(
        league, season, match_date, kickoff, home_id, away_id, status,
        fthg, ftag, hthg, htag, sh_h, sh_a, sot_h, sot_a, fo_h, fo_a, co_h, co_a, ye_h, ye_a, re_h, re_a,
        o_h, o_d, o_a, o_o25, o_u25, c_h, c_d, c_a, c_o25, c_u25, bf_h, bf_d, bf_a,
        src_result, src_fixture)
      values (
        p_league, p_season, x.match_date, x.kickoff, v_h, v_a, case when v_fin then 'finished' else 'scheduled' end,
        case when v_fin then x.fthg end, case when v_fin then x.ftag end,
        case when v_fin then x.hthg end, case when v_fin then x.htag end,
        x.sh_h, x.sh_a, x.sot_h, x.sot_a, x.fo_h, x.fo_a, x.co_h, x.co_a, x.ye_h, x.ye_a, x.re_h, x.re_a,
        x.o_h, x.o_d, x.o_a, x.o_o25, x.o_u25, x.c_h, x.c_d, x.c_a, x.c_o25, x.c_u25, x.bf_h, x.bf_d, x.bf_a,
        case when v_fin then p_source end, case when not v_fin then p_source end)
      returning id into v_id;
      n_ins := n_ins + 1;
    else
      select * into m from public.ta_matches where id = v_id for update;
      nm := m;
      if v_fin or m.status <> 'finished' then
        nm.match_date := x.match_date;
        nm.kickoff := coalesce(x.kickoff, m.kickoff);
      else
        nm.kickoff := coalesce(m.kickoff, x.kickoff);
      end if;
      if v_fin then
        nm.status := 'finished'; nm.fthg := x.fthg; nm.ftag := x.ftag;
        nm.hthg := coalesce(x.hthg, m.hthg); nm.htag := coalesce(x.htag, m.htag);
        nm.src_result := public.ta_src_add(m.src_result, p_source);
      else
        nm.src_fixture := public.ta_src_add(m.src_fixture, p_source);
      end if;
      nm.sh_h := coalesce(x.sh_h, m.sh_h);   nm.sh_a := coalesce(x.sh_a, m.sh_a);
      nm.sot_h := coalesce(x.sot_h, m.sot_h); nm.sot_a := coalesce(x.sot_a, m.sot_a);
      nm.fo_h := coalesce(x.fo_h, m.fo_h);   nm.fo_a := coalesce(x.fo_a, m.fo_a);
      nm.co_h := coalesce(x.co_h, m.co_h);   nm.co_a := coalesce(x.co_a, m.co_a);
      nm.ye_h := coalesce(x.ye_h, m.ye_h);   nm.ye_a := coalesce(x.ye_a, m.ye_a);
      nm.re_h := coalesce(x.re_h, m.re_h);   nm.re_a := coalesce(x.re_a, m.re_a);
      nm.o_h := coalesce(x.o_h, m.o_h); nm.o_d := coalesce(x.o_d, m.o_d); nm.o_a := coalesce(x.o_a, m.o_a);
      nm.o_o25 := coalesce(x.o_o25, m.o_o25); nm.o_u25 := coalesce(x.o_u25, m.o_u25);
      nm.c_h := coalesce(x.c_h, m.c_h); nm.c_d := coalesce(x.c_d, m.c_d); nm.c_a := coalesce(x.c_a, m.c_a);
      nm.c_o25 := coalesce(x.c_o25, m.c_o25); nm.c_u25 := coalesce(x.c_u25, m.c_u25);
      nm.bf_h := coalesce(x.bf_h, m.bf_h); nm.bf_d := coalesce(x.bf_d, m.bf_d); nm.bf_a := coalesce(x.bf_a, m.bf_a);

      if nm is distinct from m then
        update public.ta_matches set
          match_date = nm.match_date, kickoff = nm.kickoff, status = nm.status,
          fthg = nm.fthg, ftag = nm.ftag, hthg = nm.hthg, htag = nm.htag,
          sh_h = nm.sh_h, sh_a = nm.sh_a, sot_h = nm.sot_h, sot_a = nm.sot_a, fo_h = nm.fo_h, fo_a = nm.fo_a,
          co_h = nm.co_h, co_a = nm.co_a, ye_h = nm.ye_h, ye_a = nm.ye_a, re_h = nm.re_h, re_a = nm.re_a,
          o_h = nm.o_h, o_d = nm.o_d, o_a = nm.o_a, o_o25 = nm.o_o25, o_u25 = nm.o_u25,
          c_h = nm.c_h, c_d = nm.c_d, c_a = nm.c_a, c_o25 = nm.c_o25, c_u25 = nm.c_u25,
          bf_h = nm.bf_h, bf_d = nm.bf_d, bf_a = nm.bf_a,
          src_result = nm.src_result, src_fixture = nm.src_fixture, updated_at = now()
        where id = v_id;
        n_upd := n_upd + 1;
      end if;
    end if;
    touched := touched || v_id;
  end loop;

  if p_replace and p_kind = 'fixtures' then
    delete from public.ta_matches
     where league = p_league and season = p_season and status = 'scheduled'
       and p_source = any(string_to_array(coalesce(src_fixture, ''), '+'))
       and not (id = any(touched));
    get diagnostics n_tmp = row_count; n_rem := n_rem + n_tmp;
    -- partite mai giocate da oltre 14 giorni e senza nuova data: slot obsoleti
    delete from public.ta_matches
     where league = p_league and season = p_season and status = 'scheduled'
       and match_date < current_date - 14 and not (id = any(touched));
    get diagnostics n_tmp = row_count; n_rem := n_rem + n_tmp;
  end if;

  insert into public.ta_sync_runs(league, season, source, kind, ok, rows_in, inserted, updated, removed, message)
  values (p_league, p_season, p_source, p_kind, true, n_in, n_ins, n_upd, n_rem,
          case when n_skip > 0 then n_skip || ' righe scartate' end);

  return jsonb_build_object('rows', n_in, 'inserted', n_ins, 'updated', n_upd, 'removed', n_rem, 'skipped', n_skip);
end $$;

-- Istantanea compatta (colonnare) di una stagione per l'app.
create or replace function public.ta_snapshot(p_season text) returns json
language sql stable set search_path = public
as $$
  with s as (
    select * from public.ta_matches where season = p_season
    order by match_date, kickoff nulls last, id
  )
  select json_build_object(
    'v', 1, 'season', p_season, 'n', count(*),
    'updatedAt', max(updated_at),
    'id',  coalesce(json_agg(id), '[]'),
    'lg',  coalesce(json_agg(league), '[]'),
    'd',   coalesce(json_agg(match_date - date '1970-01-01'), '[]'),
    'ko',  coalesce(json_agg((extract(epoch from kickoff) / 60)::int), '[]'),
    'h',   coalesce(json_agg(home_id), '[]'),
    'a',   coalesce(json_agg(away_id), '[]'),
    'fh',  coalesce(json_agg(fthg), '[]'),  'fa', coalesce(json_agg(ftag), '[]'),
    'hh',  coalesce(json_agg(hthg), '[]'),  'ha', coalesce(json_agg(htag), '[]'),
    'shh', coalesce(json_agg(sh_h), '[]'),  'sha', coalesce(json_agg(sh_a), '[]'),
    'soh', coalesce(json_agg(sot_h), '[]'), 'soa', coalesce(json_agg(sot_a), '[]'),
    'coh', coalesce(json_agg(co_h), '[]'),  'coa', coalesce(json_agg(co_a), '[]'),
    'yeh', coalesce(json_agg(ye_h), '[]'),  'yea', coalesce(json_agg(ye_a), '[]'),
    'reh', coalesce(json_agg(re_h), '[]'),  'rea', coalesce(json_agg(re_a), '[]'),
    'oh',  coalesce(json_agg(o_h), '[]'),   'od', coalesce(json_agg(o_d), '[]'),  'oa', coalesce(json_agg(o_a), '[]'),
    'oo',  coalesce(json_agg(o_o25), '[]'), 'ou', coalesce(json_agg(o_u25), '[]'),
    'ch',  coalesce(json_agg(c_h), '[]'),   'cd', coalesce(json_agg(c_d), '[]'),  'ca', coalesce(json_agg(c_a), '[]'),
    'co',  coalesce(json_agg(c_o25), '[]'), 'cu', coalesce(json_agg(c_u25), '[]'),
    'bh',  coalesce(json_agg(bf_h), '[]'),  'bd', coalesce(json_agg(bf_d), '[]'), 'ba', coalesce(json_agg(bf_a), '[]')
  ) from s;
$$;

create or replace function public.ta_reference_snapshot() returns json
language sql stable set search_path = public
as $$
  select json_build_object(
    'v', 1,
    'leagues', (select coalesce(json_agg(json_build_object(
                  'code', code, 'name', name, 'country', country, 'countryName', country_name,
                  'tier', tier, 'sort', sort) order by sort, code), '[]')
                from public.ta_leagues where active),
    'teams', (select coalesce(json_agg(json_build_array(id, country, name, status) order by id), '[]')
              from public.ta_teams)
  );
$$;

-- Stagioni modificate dopo l'ultima pubblicazione.
create or replace function public.ta_seasons_state() returns table(season text, n bigint, updated_at timestamptz)
language sql stable set search_path = public
as $$ select season, count(*), max(updated_at) from public.ta_matches group by season order by season $$;

-- Verifica del token di sincronizzazione (salvato nel Vault, mai nel codice).
create or replace function public.ta_check_sync_token(p_token text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from vault.decrypted_secrets where name = 'ta_sync_token' and decrypted_secret = p_token);
$$;

revoke execute on function public.ta_src_add(text, text) from public, anon, authenticated;
revoke execute on function public.ta_resolve_team(text, text, boolean) from public, anon, authenticated;
revoke execute on function public.ta_ingest(text, text, text, text, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.ta_snapshot(text) from public, anon, authenticated;
revoke execute on function public.ta_reference_snapshot() from public, anon, authenticated;
revoke execute on function public.ta_seasons_state() from public, anon, authenticated;
revoke execute on function public.ta_check_sync_token(text) from public, anon, authenticated;
grant execute on function public.ta_src_add(text, text) to service_role;
grant execute on function public.ta_resolve_team(text, text, boolean) to service_role;
grant execute on function public.ta_ingest(text, text, text, text, jsonb, boolean) to service_role;
grant execute on function public.ta_snapshot(text) to service_role;
grant execute on function public.ta_reference_snapshot() to service_role;
grant execute on function public.ta_seasons_state() to service_role;
grant execute on function public.ta_check_sync_token(text) to service_role;
