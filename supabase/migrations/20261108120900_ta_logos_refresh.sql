-- Trading Analytics v1.3 · loghi delle squadre e aggiornamento dei risultati su richiesta.

alter table public.ta_teams add column if not exists logo text;
alter table public.ta_teams add column if not exists logo_checked_at timestamptz;

-- L'anagrafica pubblicata include il logo (5° elemento) quando disponibile.
create or replace function public.ta_reference_snapshot() returns json
language sql stable set search_path = public
as $$
  select json_build_object(
    'v', 1,
    'leagues', (select coalesce(json_agg(json_build_object(
                  'code', code, 'name', name, 'country', country, 'countryName', country_name,
                  'tier', tier, 'sort', sort) order by sort, code), '[]')
                from public.ta_leagues where active),
    'teams', (select coalesce(json_agg(json_build_array(id, country, name, status, logo) order by id), '[]')
              from public.ta_teams)
  );
$$;
revoke execute on function public.ta_reference_snapshot() from public, anon, authenticated;
grant execute on function public.ta_reference_snapshot() to service_role;

-- Aggiornamento su richiesta dal pulsante "Aggiorna" dell'app.
-- Chiunque può chiederlo, ma al massimo una volta ogni 10 minuti (per tutti).
create or replace function public.ta_request_refresh()
returns jsonb language plpgsql security definer
set search_path = ''
as $$
declare v_last timestamptz; v_wait int;
begin
  select updated_at into v_last from public.ta_meta where key = 'manual_refresh' for update;
  if v_last is not null and v_last > now() - interval '10 minutes' then
    v_wait := extract(epoch from (v_last + interval '10 minutes' - now()))::int;
    return jsonb_build_object('ok', false, 'started_at', v_last, 'wait_seconds', v_wait);
  end if;
  insert into public.ta_meta(key, value, updated_at) values ('manual_refresh', to_jsonb(now()), now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;
  perform public.ta_call_sync('{"mode":"refresh"}'::jsonb);
  return jsonb_build_object('ok', true, 'started_at', now());
end $$;
revoke execute on function public.ta_request_refresh() from public;
grant execute on function public.ta_request_refresh() to anon, authenticated;
