-- Advisor prestazioni: chiave primaria per ta_goal_events.
alter table public.ta_goal_events add column if not exists id bigserial primary key;
