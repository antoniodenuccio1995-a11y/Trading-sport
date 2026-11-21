-- 2. Bundesliga (D2): campionato attivato, con i nomi di Open Matchday collegati a quelli di football-data.
-- Le altre squadre della D2 erano già collegate (molte hanno giocato in Bundesliga).
insert into public.ta_team_aliases (scope, alias, alias_norm, team_country, team_name, note)
select 'GER', a, public.ta_norm(a), 'GER', t, 'Open Matchday 2. Bundesliga'
from (values
  ('DSC Arminia Bielefeld', 'Bielefeld'),
  ('Dynamo Dresden', 'Dresden'),
  ('Energie Cottbus', 'Cottbus'),
  ('VfL Osnabrück', 'Osnabruck')
) v(a, t)
on conflict (scope, alias_norm) do nothing;

update public.ta_leagues set active = true where code = 'D2';
select public.ta_schedule_leagues();

-- Dopo l'attivazione (eseguito a parte, una volta):
-- select public.ta_call_sync('{"mode":"league","league":"D2","scope":"all"}'::jsonb);
-- select public.ta_call_sync('{"mode":"publish"}'::jsonb);
