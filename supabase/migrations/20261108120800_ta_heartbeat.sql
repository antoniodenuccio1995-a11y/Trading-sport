-- Contro la pausa del piano gratuito (7 giorni senza attività): una piccola scrittura
-- giornaliera nel database, indipendente dalla sincronizzazione dei dati.
select cron.schedule('ta-heartbeat', '7 12 * * *',
  $$insert into public.ta_meta(key, value, updated_at) values ('heartbeat', to_jsonb(now()), now())
    on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at$$);
