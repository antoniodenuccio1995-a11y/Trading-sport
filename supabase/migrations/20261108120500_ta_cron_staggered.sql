-- Le Edge Functions del piano gratuito non reggono 16 sincronizzazioni contemporanee
-- (errore WORKER_RESOURCE_LIMIT): ogni campionato ha il suo minuto.
select cron.unschedule('ta-sync-leagues');
select cron.unschedule('ta-sync-odds');
select cron.unschedule('ta-sync-publish');

create or replace function public.ta_schedule_leagues()
returns int language plpgsql security definer
set search_path = ''
as $$
declare r record; i int := 0;
begin
  for r in select jobname from cron.job where jobname like 'ta-sync-lg-%' loop
    perform cron.unschedule(r.jobname);
  end loop;
  for r in select code from public.ta_leagues where active order by sort loop
    -- 06:30… e 17:30… UTC, un campionato al minuto
    perform cron.schedule('ta-sync-lg-' || r.code, (30 + i) || ' 6,17 * * *',
      format('select public.ta_call_sync(%L::jsonb)', jsonb_build_object('mode', 'league', 'league', r.code, 'scope', 'current')::text));
    i := i + 1;
  end loop;
  return i;
end $$;
revoke execute on function public.ta_schedule_leagues() from public, anon, authenticated;

select public.ta_schedule_leagues();
select cron.schedule('ta-sync-odds',    '50 6,17 * * *', $$select public.ta_call_sync('{"mode":"fixtures"}'::jsonb)$$);
select cron.schedule('ta-sync-publish', '55 6,17 * * *', $$select public.ta_call_sync('{"mode":"publish"}'::jsonb)$$);
