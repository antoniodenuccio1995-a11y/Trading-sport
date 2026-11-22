-- Partecipazione di nozze di Antonio e Giulia: conferme di presenza.
-- Tabelle con prefisso nozze_ per convivere con le altre app del progetto.
-- Gli invitati scrivono solo con nozze_conferma(); gli sposi leggono con nozze_riepilogo(codice).
-- Nessun accesso diretto alle tabelle da anon/authenticated (RLS attiva, nessuna policy).

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.nozze_conferme (
  id         bigint generated always as identity primary key,
  creata     timestamptz not null default now(),
  nome       text not null check (char_length(nome) between 1 and 120),
  presenza   boolean not null,
  persone    smallint not null default 1 check (persone between 0 and 12),
  allergie   text check (char_length(allergie) <= 300),
  messaggio  text check (char_length(messaggio) <= 1000),
  invito_per text check (char_length(invito_per) <= 80),   -- nome scritto sulla busta (?per= nel link)
  scritto_a  text check (scritto_a in ('antonio', 'giulia'))
);
comment on table public.nozze_conferme is 'Conferme di presenza al matrimonio di Antonio e Giulia (27/05/2027). Scrittura solo da nozze_conferma(), lettura solo da nozze_riepilogo().';
alter table public.nozze_conferme enable row level security;

-- impostazioni private; la riga ''codice'' contiene solo l'impronta bcrypt del codice degli sposi,
-- impostata a mano e non salvata nel repository:
--   insert into public.nozze_impostazioni values ('codice', extensions.crypt('<codice>', extensions.gen_salt('bf')))
--   on conflict (chiave) do update set valore = excluded.valore;
create table if not exists public.nozze_impostazioni (
  chiave text primary key,
  valore text not null
);
alter table public.nozze_impostazioni enable row level security;

create or replace function public.nozze_conferma(
  p_nome text,
  p_presenza boolean,
  p_persone integer default 1,
  p_allergie text default null,
  p_messaggio text default null,
  p_per text default null,
  p_scritto_a text default null
) returns bigint
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Scrivi il tuo nome.' using errcode = '22023';
  end if;
  if p_presenza is null then
    raise exception 'Scegli se ci sarai.' using errcode = '22023';
  end if;
  -- freno semplice contro gli invii a raffica
  if (select count(*) from public.nozze_conferme where creata > now() - interval '1 minute') >= 30 then
    raise exception 'Troppe risposte in questo momento: riprova tra un minuto.' using errcode = '53400';
  end if;
  insert into public.nozze_conferme (nome, presenza, persone, allergie, messaggio, invito_per, scritto_a)
  values (
    left(btrim(p_nome), 120),
    p_presenza,
    case when p_presenza then greatest(1, least(coalesce(p_persone, 1), 12)) else 0 end,
    nullif(left(btrim(coalesce(p_allergie, '')), 300), ''),
    nullif(left(btrim(coalesce(p_messaggio, '')), 1000), ''),
    nullif(left(btrim(coalesce(p_per, '')), 80), ''),
    case when p_scritto_a in ('antonio', 'giulia') then p_scritto_a end
  )
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.nozze_riepilogo(p_codice text)
returns setof public.nozze_conferme
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_hash text;
begin
  select valore into v_hash from public.nozze_impostazioni where chiave = 'codice';
  if v_hash is null or p_codice is null or extensions.crypt(p_codice, v_hash) <> v_hash then
    perform pg_sleep(1.5); -- rallenta chi prova codici a caso
    raise exception 'Codice non valido.' using errcode = '28P01';
  end if;
  return query select * from public.nozze_conferme order by creata desc;
end
$$;

revoke all on function public.nozze_conferma(text, boolean, integer, text, text, text, text) from public;
revoke all on function public.nozze_riepilogo(text) from public;
grant execute on function public.nozze_conferma(text, boolean, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.nozze_riepilogo(text) to anon, authenticated;
