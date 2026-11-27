-- Terzo aggiornamento automatico, di notte (00:30 UTC = 01:30 in Italia d'inverno, 02:30 d'estate),
-- dopo le partite serali: i dati sono pronti già al mattino presto. Restano i giri delle 06:30 e 17:30 UTC.
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
    -- 00:30…, 06:30… e 17:30… UTC, un campionato al minuto
    perform cron.schedule('ta-sync-lg-' || r.code, (30 + i) || ' 0,6,17 * * *',
      format('select public.ta_call_sync(%L::jsonb)', jsonb_build_object('mode', 'league', 'league', r.code, 'scope', 'current')::text));
    i := i + 1;
  end loop;
  return i;
end $$;
revoke execute on function public.ta_schedule_leagues() from public, anon, authenticated;

select public.ta_schedule_leagues();
select cron.schedule('ta-sync-odds',    '50 0,6,17 * * *', $$select public.ta_call_sync('{"mode":"fixtures"}'::jsonb)$$);
select cron.schedule('ta-sync-publish', '55 0,6,17 * * *', $$select public.ta_call_sync('{"mode":"publish"}'::jsonb)$$);
