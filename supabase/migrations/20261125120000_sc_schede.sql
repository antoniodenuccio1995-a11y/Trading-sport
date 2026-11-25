-- Schede di investimento DiSalento: una riga per scheda, tutti i dati (testi, numeri, foto) in JSON.
-- Chi ha il link legge con sc_leggi(id) e controlla gli aggiornamenti con sc_versione(id).
-- sc_crea(dati) crea una scheda e restituisce la chiave di modifica (salvata solo come impronta bcrypt);
-- sc_salva(id, chiave, dati, versione) aggiorna la scheda solo con la chiave giusta.
-- Nessun accesso diretto alla tabella da anon/authenticated (RLS attiva, nessuna policy).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.sc_schede (
  id          uuid primary key default gen_random_uuid(),
  creata      timestamptz not null default now(),
  aggiornata  timestamptz not null default now(),
  versione    integer not null default 1,
  chiave_hash text not null,
  dati        jsonb not null check (jsonb_typeof(dati) = 'object' and octet_length(dati::text) <= 8000000)
);
comment on table public.sc_schede is 'Schede di investimento DiSalento. Lettura con sc_leggi()/sc_versione(), scrittura con sc_crea()/sc_salva().';
alter table public.sc_schede enable row level security;

create or replace function public.sc_crea(p_dati jsonb)
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
  -- freno semplice contro le creazioni a raffica
  if (select count(*) from public.sc_schede s where s.creata > now() - interval '1 minute') >= 20 then
    raise exception 'Troppe schede create in questo momento: riprova tra un minuto.' using errcode = '53400';
  end if;
  insert into public.sc_schede as s (chiave_hash, dati)
  values (extensions.crypt(v_chiave, extensions.gen_salt('bf')), p_dati)
  returning s.id into v_id;
  return query select v_id, v_chiave;
end;
$$;

create or replace function public.sc_leggi(p_id uuid)
returns table (dati jsonb, versione integer, aggiornata timestamptz)
language sql stable security definer set search_path = ''
as $$
  select s.dati, s.versione, s.aggiornata from public.sc_schede s where s.id = p_id;
$$;

create or replace function public.sc_versione(p_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select s.versione from public.sc_schede s where s.id = p_id;
$$;

create or replace function public.sc_salva(p_id uuid, p_chiave text, p_dati jsonb, p_versione integer default null)
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_hash text;
  v_ver integer;
begin
  if p_dati is null or jsonb_typeof(p_dati) <> 'object' then
    raise exception 'Dati della scheda non validi.' using errcode = '22023';
  end if;
  select s.chiave_hash, s.versione into v_hash, v_ver from public.sc_schede s where s.id = p_id for update;
  if not found then
    raise exception 'Scheda non trovata.' using errcode = 'P0002';
  end if;
  if v_hash <> extensions.crypt(coalesce(p_chiave, ''), v_hash) then
    raise exception 'Chiave di modifica non valida.' using errcode = '42501';
  end if;
  if p_versione is not null and p_versione <> v_ver then
    raise exception 'La scheda è stata modificata da un altro dispositivo.' using errcode = '40001';
  end if;
  update public.sc_schede s set dati = p_dati, versione = v_ver + 1, aggiornata = now() where s.id = p_id;
  return v_ver + 1;
end;
$$;

revoke all on function public.sc_crea(jsonb) from public;
revoke all on function public.sc_leggi(uuid) from public;
revoke all on function public.sc_versione(uuid) from public;
revoke all on function public.sc_salva(uuid, text, jsonb, integer) from public;
grant execute on function public.sc_crea(jsonb) to anon, authenticated;
grant execute on function public.sc_leggi(uuid) to anon, authenticated;
grant execute on function public.sc_versione(uuid) to anon, authenticated;
grant execute on function public.sc_salva(uuid, text, jsonb, integer) to anon, authenticated;
