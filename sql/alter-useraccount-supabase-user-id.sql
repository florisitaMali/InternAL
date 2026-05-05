-- Links public.useraccount rows to Supabase Auth (auth.users.id) after first login.
-- Safe to run once; column is optional for backends that only match on email.

ALTER TABLE public.useraccount
  ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS useraccount_supabase_user_id_key
  ON public.useraccount (supabase_user_id)
  WHERE supabase_user_id IS NOT NULL;

COMMENT ON COLUMN public.useraccount.supabase_user_id IS 'Supabase Auth user UUID (sub claim); set on first successful API call after invite/login.';
