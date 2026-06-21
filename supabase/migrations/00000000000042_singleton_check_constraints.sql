-- 00000000000042_singleton_check_constraints.sql
-- Adds CHECK (id = 1) constraints to the five tables that the admin
-- code already treats as singletons via `.single()` reads without a
-- WHERE clause. Without the constraint, a future INSERT (operator
-- error, bad seed, runaway script) could create a second row — and the
-- next .single() read would error with "more than one row returned"
-- which surfaces as the admin page silently going blank.
--
-- Tables in scope (all integer-PK, all currently hold exactly id=1):
--   business_info               — biz registration + contact info
--   chatbot_config              — AI chatbot enable/greeting/etc.
--   registration_config         — signup form policy
--   identity_verification_config— phone/email verification policy
--   instagram_config            — handle + RSS URL
--
-- shorts_config is also singleton-shaped in code but uses a UUID PK,
-- so the same constraint doesn't apply — left alone.

do $$
declare
  t text;
begin
  foreach t in array array['business_info', 'chatbot_config', 'registration_config',
                            'identity_verification_config', 'instagram_config']
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %; table does not exist', t;
      continue;
    end if;
    if exists (
      select 1 from pg_constraint
      where conname = t || '_singleton_check'
        and conrelid = ('public.' || t)::regclass
    ) then
      raise notice 'skipping %; constraint already exists', t;
      continue;
    end if;
    execute format(
      'alter table public.%I add constraint %I check (id = 1)',
      t, t || '_singleton_check'
    );
  end loop;
end $$;
