-- Finanza Personale v4: anche strumenti, operazioni e prezzi degli investimenti si sincronizzano.
alter table public.fp_records drop constraint if exists fp_records_kind_check;
alter table public.fp_records add constraint fp_records_kind_check
  check (kind in ('movement', 'rule', 'account', 'category', 'budget', 'setting', 'import', 'instrument', 'trade', 'invest'));
