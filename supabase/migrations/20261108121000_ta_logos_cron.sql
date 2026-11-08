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

-- 2026-11-08: TheSportsDB indica i Paesi Bassi come "The Netherlands" e le gallesi come "Wales":
-- stemmi olandesi recuperati a mano, gli altri rimessi in coda (la funzione ora conosce i nomi alternativi).
-- update public.ta_teams set logo_checked_at = null where logo is null;
-- select cron.schedule('ta-logos', '*/3 * * * *', $$select public.ta_logos_tick()$$);
-- 2026-11-08 (2): le risposte di blocco del servizio (403/5xx, pagina HTML) venivano lette come "stemma assente";
-- funzione corretta (ora riprova più tardi) e squadre senza stemma rimesse in coda con lo stesso comando qui sopra.
