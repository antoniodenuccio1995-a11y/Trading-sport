-- Ricerca degli stemmi a piccoli blocchi (servizio gratuito con limiti di frequenza).
-- Finché ci sono squadre mai controllate gira ogni 2 minuti, poi passa a una volta al giorno.
create or replace function public.ta_logos_tick()
returns text language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.ta_teams where logo_checked_at is null) then
    perform public.ta_call_sync('{"mode":"logos","limit":8}'::jsonb);
    return 'avviato';
  end if;
  perform cron.unschedule('ta-logos');
  perform cron.schedule('ta-logos-daily', '20 4 * * *', $c$select public.ta_call_sync('{"mode":"logos","limit":8}'::jsonb)$c$);
  return 'completato';
end $$;
revoke execute on function public.ta_logos_tick() from public, anon, authenticated;

select cron.schedule('ta-logos', '*/2 * * * *', $$select public.ta_logos_tick()$$);
