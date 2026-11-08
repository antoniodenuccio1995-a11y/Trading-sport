-- Trading Analytics v1 · unione di squadre doppie e correzioni dopo il primo import completo.

-- Le squadre create tramite alias da una fonte di riferimento sono verificate.
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
      insert into public.ta_teams(country, name, status) values (v_c, v_n, case when p_canonical then 'ok' else 'nuova' end)
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

-- Unisce la squadra p_from in p_into. Nei campionati a girone unico elimina le copie
-- della stessa partita che l'unione renderebbe doppie (la sincronizzazione successiva
-- completa la riga rimasta con i dati dell'altra fonte).
create or replace function public.ta_merge_team(p_from int, p_into int)
returns jsonb language plpgsql
set search_path = public
as $$
declare n_dup int; n_h int; n_a int; v_from text; v_into text; v_country text;
begin
  if p_from = p_into then raise exception 'stessa squadra'; end if;
  select name, country into v_from, v_country from public.ta_teams where id = p_from;
  select name into v_into from public.ta_teams where id = p_into;
  if v_from is null or v_into is null then raise exception 'squadra inesistente'; end if;

  delete from public.ta_matches m using public.ta_leagues l
   where l.code = m.league and not l.multi_meeting and (m.home_id = p_from or m.away_id = p_from)
     and exists (select 1 from public.ta_matches o
                  where o.league = m.league and o.season = m.season and o.id <> m.id
                    and o.home_id = case when m.home_id = p_from then p_into else m.home_id end
                    and o.away_id = case when m.away_id = p_from then p_into else m.away_id end);
  get diagnostics n_dup = row_count;
  update public.ta_matches set home_id = p_into, updated_at = now() where home_id = p_from;
  get diagnostics n_h = row_count;
  update public.ta_matches set away_id = p_into, updated_at = now() where away_id = p_from;
  get diagnostics n_a = row_count;
  delete from public.ta_teams where id = p_from;
  -- il vecchio nome resta come alias, così le prossime sincronizzazioni lo riconoscono
  insert into public.ta_team_aliases(scope, alias_norm, alias, team_country, team_name, note)
  select v_country, public.ta_norm(v_from), v_from, t.country, t.name, 'unione ' || now()::date
    from public.ta_teams t where t.id = p_into
  on conflict (scope, alias_norm) do update set team_country = excluded.team_country, team_name = excluded.team_name, note = excluded.note;
  return jsonb_build_object('from', v_from, 'into', v_into, 'duplicates_removed', n_dup, 'moved', n_h + n_a);
end $$;
revoke execute on function public.ta_merge_team(int, int) from public, anon, authenticated;
grant execute on function public.ta_merge_team(int, int) to service_role;

-- Correzioni emerse dal primo import (2026-11-08)
select public.ta_merge_team((select id from public.ta_teams where country = 'ESP' and name = 'CA Osasuna'),
                            (select id from public.ta_teams where country = 'ESP' and name = 'Osasuna'));
select public.ta_merge_team((select id from public.ta_teams where country = 'ESP' and name = 'RC Celta Fortuna'),
                            (select id from public.ta_teams where country = 'ESP' and name = 'Celta B'));
select public.ta_merge_team((select id from public.ta_teams where country = 'ROU' and name = 'Din. Bucuresti'),
                            (select id from public.ta_teams where country = 'ROU' and name = 'Dinamo Bucuresti'));

-- Le squadre con risultati football-data nelle stagioni concluse sono identità verificate;
-- le squadre estere della Champions sono state inserite di proposito.
update public.ta_teams t set status = 'ok'
 where status = 'nuova' and (
   exists (select 1 from public.ta_matches m where (m.home_id = t.id or m.away_id = t.id) and m.season < '2026/27' and m.src_result like 'fd%')
   or t.country not in ('ITA','ENG','ESP','FRA','GER','NED','POR','DNK','ROU','CRO'));
