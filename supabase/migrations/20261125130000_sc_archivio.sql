-- Archivio delle schede: un codice scelto dal proprietario (almeno 8 caratteri) raggruppa le sue schede.
-- Con il codice si vede l'elenco (sc_elenco) e si modifica da qualsiasi dispositivo (sc_salva accetta chiave o codice).
-- Il codice non e' salvato in chiaro: solo la sua impronta sha256 (serve per cercare le schede del proprietario).

alter table public.sc_schede add column if not exists archivio text;
create index if not exists sc_schede_archivio_idx on public.sc_schede (archivio);

create or replace function public.sc_impronta(p_codice text)
returns text
language sql immutable set search_path = ''
as $$
  select case when length(coalesce(p_codice, '')) >= 8
    then encode(extensions.digest('sc-archivio:' || p_codice, 'sha256'), 'hex') end;
$$;
revoke all on function public.sc_impronta(text) from public;

drop function if exists public.sc_crea(jsonb);
create or replace function public.sc_crea(p_dati jsonb, p_codice text default null)
returns table (id uuid, chiave text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_chiave text := encode(extensions.gen_random_bytes(18), 'hex');
  v_id uuid;
begin
  if p_dati is null or jsonb_typeof(p_dati) <> 'object' then
    raise exception 'Dati della scheda non validi.' using errcode = '22023';
  end if;
  if (select count(*) from public.sc_schede s where s.creata > now() - interval '1 minute') >= 20 then
    raise exception 'Troppe schede create in questo momento: riprova tra un minuto.' using errcode = '53400';
  end if;
  insert into public.sc_schede as s (chiave_hash, dati, archivio)
  values (extensions.crypt(v_chiave, extensions.gen_salt('bf')), p_dati, public.sc_impronta(p_codice))
  returning s.id into v_id;
  return query select v_id, v_chiave;
end;
$$;

-- vero se chiave o codice permettono di modificare la scheda
create or replace function public.sc_verifica(p_id uuid, p_chiave text default null, p_codice text default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select (p_chiave is not null and s.chiave_hash = extensions.crypt(p_chiave, s.chiave_hash))
        or (s.archivio is not null and s.archivio = public.sc_impronta(p_codice))
    from public.sc_schede s where s.id = p_id), false);
$$;

drop function if exists public.sc_salva(uuid, text, jsonb, integer);
create or replace function public.sc_salva(p_id uuid, p_chiave text, p_dati jsonb, p_versione integer default null, p_codice text default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_ver integer;
begin
  if p_dati is null or jsonb_typeof(p_dati) <> 'object' then
    raise exception 'Dati della scheda non validi.' using errcode = '22023';
  end if;
  select s.versione into v_ver from public.sc_schede s where s.id = p_id for update;
  if not found then
    raise exception 'Scheda non trovata.' using errcode = 'P0002';
  end if;
  if not public.sc_verifica(p_id, p_chiave, p_codice) then
    raise exception 'Chiave di modifica non valida.' using errcode = '42501';
  end if;
  if p_versione is not null and p_versione <> v_ver then
    raise exception 'La scheda è stata modificata da un altro dispositivo.' using errcode = '40001';
  end if;
  update public.sc_schede s set dati = p_dati, versione = v_ver + 1, aggiornata = now() where s.id = p_id;
  return v_ver + 1;
end;
$$;

-- elenco delle schede di un archivio (piu' recenti prima)
create or replace function public.sc_elenco(p_codice text)
returns table (id uuid, nome text, titolo text, destinatario text, creata timestamptz, aggiornata timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.dati->>'nome', s.dati->>'titolo', s.dati->>'destinatario', s.creata, s.aggiornata
  from public.sc_schede s
  where public.sc_impronta(p_codice) is not null and s.archivio = public.sc_impronta(p_codice)
  order by s.aggiornata desc
  limit 500;
$$;

-- aggiunge all'archivio una scheda creata senza codice (serve la sua chiave di modifica)
create or replace function public.sc_collega(p_id uuid, p_chiave text, p_codice text)
returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if public.sc_impronta(p_codice) is null then
    raise exception 'Il codice dell’archivio deve avere almeno 8 caratteri.' using errcode = '22023';
  end if;
  if not public.sc_verifica(p_id, p_chiave, null) then
    raise exception 'Chiave di modifica non valida.' using errcode = '42501';
  end if;
  update public.sc_schede s set archivio = public.sc_impronta(p_codice) where s.id = p_id;
  return true;
end;
$$;

revoke all on function public.sc_crea(jsonb, text) from public;
revoke all on function public.sc_verifica(uuid, text, text) from public;
revoke all on function public.sc_salva(uuid, text, jsonb, integer, text) from public;
revoke all on function public.sc_elenco(text) from public;
revoke all on function public.sc_collega(uuid, text, text) from public;
grant execute on function public.sc_crea(jsonb, text) to anon, authenticated;
grant execute on function public.sc_verifica(uuid, text, text) to anon, authenticated;
grant execute on function public.sc_salva(uuid, text, jsonb, integer, text) to anon, authenticated;
grant execute on function public.sc_elenco(text) to anon, authenticated;
grant execute on function public.sc_collega(uuid, text, text) to anon, authenticated;
