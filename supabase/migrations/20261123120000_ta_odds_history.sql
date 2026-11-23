-- Storico delle quote delle partite da giocare: ogni volta che una fonte cambia una quota, se ne salva una copia.
-- Oggi la fonte è football-data (medie bookmaker e Betfair Exchange); con la chiave Betfair arriveranno rilevazioni frequenti (src = 'bf').
create table if not exists public.ta_odds_hist (
  id bigserial primary key,
  match_id bigint not null references public.ta_matches(id) on delete cascade,
  taken_at timestamptz not null default now(),
  src text not null default 'fd',
  o_h numeric, o_d numeric, o_a numeric, o_o25 numeric, o_u25 numeric,
  bf_h numeric, bf_d numeric, bf_a numeric
);
create index if not exists ta_odds_hist_match_idx on public.ta_odds_hist (match_id, taken_at);

alter table public.ta_odds_hist enable row level security;
-- dati pubblici come le partite: lettura per tutti, scrittura solo dal server
create policy ta_odds_hist_read on public.ta_odds_hist for select to anon, authenticated using (true);
grant select on public.ta_odds_hist to anon, authenticated;

create or replace function public.ta_odds_snapshot() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status <> 'scheduled' or coalesce(new.o_h, new.o_o25, new.bf_h) is null then return new; end if;
  if tg_op = 'UPDATE' then
    if (new.o_h, new.o_d, new.o_a, new.o_o25, new.o_u25, new.bf_h, new.bf_d, new.bf_a)
       is not distinct from (old.o_h, old.o_d, old.o_a, old.o_o25, old.o_u25, old.bf_h, old.bf_d, old.bf_a) then
      return new;
    end if;
  end if;
  insert into public.ta_odds_hist (match_id, src, o_h, o_d, o_a, o_o25, o_u25, bf_h, bf_d, bf_a)
  values (new.id, 'fd', new.o_h, new.o_d, new.o_a, new.o_o25, new.o_u25, new.bf_h, new.bf_d, new.bf_a);
  return new;
end $$;
revoke execute on function public.ta_odds_snapshot() from public, anon, authenticated;

drop trigger if exists ta_matches_odds_hist on public.ta_matches;
create trigger ta_matches_odds_hist after insert or update of o_h, o_d, o_a, o_o25, o_u25, bf_h, bf_d, bf_a on public.ta_matches
  for each row execute function public.ta_odds_snapshot();

-- punto di partenza: le quote attuali delle partite già in calendario
insert into public.ta_odds_hist (match_id, src, o_h, o_d, o_a, o_o25, o_u25, bf_h, bf_d, bf_a)
select id, 'fd', o_h, o_d, o_a, o_o25, o_u25, bf_h, bf_d, bf_a from public.ta_matches
where status = 'scheduled' and coalesce(o_h, o_o25, bf_h) is not null;
