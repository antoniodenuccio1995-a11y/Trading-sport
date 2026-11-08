-- Advisor di sicurezza: pg_net non deve stare nello schema public.
-- Le funzioni restano in net.* e i job pianificati continuano a funzionare.
drop extension if exists pg_net;
create extension pg_net with schema extensions;
