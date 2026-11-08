-- Trading Analytics v1 · pianificazione degli aggiornamenti automatici.
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Chiama la Edge Function ta-sync con il token salvato nel Vault. Ritorna l'id della richiesta pg_net.
create or replace function public.ta_call_sync(p_body jsonb)
returns bigint language plpgsql security definer
set search_path = ''
as $$
declare v_token text; v_id bigint;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'ta_sync_token';
  if v_token is null then raise exception 'token ta_sync_token mancante nel Vault'; end if;
  select net.http_post(
    url := 'https://cqfxjvrpspvycocvxghv.supabase.co/functions/v1/ta-sync',
    body := p_body,
    headers := jsonb_build_object('content-type', 'application/json', 'x-ta-token', v_token),
    timeout_milliseconds := 150000
  ) into v_id;
  return v_id;
end $$;

-- Una richiesta per ogni campionato attivo (in parallelo).
create or replace function public.ta_sync_all(p_scope text default 'current')
returns int language plpgsql security definer
set search_path = ''
as $$
declare r record; n int := 0;
begin
  for r in select code from public.ta_leagues where active order by sort loop
    perform public.ta_call_sync(jsonb_build_object('mode', 'league', 'league', r.code, 'scope', p_scope));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.ta_call_sync(jsonb) from public, anon, authenticated;
revoke execute on function public.ta_sync_all(text) from public, anon, authenticated;

-- Orari in UTC. Open Matchday si aggiorna verso le 06:00 UTC; football-data più volte a settimana.
select cron.schedule('ta-sync-leagues',  '30 6 * * *',  $$select public.ta_sync_all('current')$$);
select cron.schedule('ta-sync-odds',     '40 6,16 * * *', $$select public.ta_call_sync('{"mode":"fixtures"}'::jsonb)$$);
select cron.schedule('ta-sync-publish',  '55 6,16 * * *', $$select public.ta_call_sync('{"mode":"publish"}'::jsonb)$$);
-- Pulizia delle risposte pg_net più vecchie di 3 giorni.
select cron.schedule('ta-net-cleanup', '15 3 * * *', $$delete from net._http_response where created < now() - interval '3 days'$$);
