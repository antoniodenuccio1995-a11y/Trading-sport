-- Finanza Personale v4: sincronizzazione tra dispositivi.
-- Una riga per record (movimento, regola, conto, categoria, budget, impostazioni, importazione).
-- I dispositivi inviano solo le righe cambiate e scaricano quelle aggiornate dopo l'ultimo controllo.
-- Le cancellazioni restano come righe con deleted = true, così gli altri dispositivi le ricevono.

create table if not exists public.fp_records (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text        not null check (kind in ('movement', 'rule', 'account', 'category', 'budget', 'setting', 'import')),
  key        text        not null,
  value      jsonb,
  deleted    boolean     not null default false,
  device     text,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

comment on table public.fp_records is 'Finanza Personale v4: dati del titolare sincronizzati tra dispositivi (una riga per record). Lettura e scrittura solo del proprio account (RLS).';

create index if not exists fp_records_user_updated on public.fp_records (user_id, updated_at);

-- L'ora di aggiornamento la decide il server: i dispositivi possono avere l'orologio sbagliato.
create or replace function public.fp_records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists fp_records_touch on public.fp_records;
create trigger fp_records_touch before insert or update on public.fp_records
  for each row execute function public.fp_records_touch();

alter table public.fp_records enable row level security;

create policy fp_records_select on public.fp_records for select to authenticated using ((select auth.uid()) = user_id);
create policy fp_records_insert on public.fp_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy fp_records_update on public.fp_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy fp_records_delete on public.fp_records for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.fp_records from anon;
grant select, insert, update, delete on public.fp_records to authenticated;
