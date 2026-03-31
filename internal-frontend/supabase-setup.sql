-- Run this in Supabase SQL Editor after your InternAL tables exist.
--
-- Prerequisites for login:
-- 1) Each row in useraccount must use the same email as a user in auth.users (Authentication → Users),
--    with that user created via Supabase Auth (sign up / dashboard invite). The password column on
--    useraccount is not used by this app — Supabase Auth owns passwords.
-- 2) In Authentication → URL configuration, add redirect URLs:
--    http://localhost:3000/auth/reset   and your production URL + /auth/reset
-- 1) Lets logged-in users read their own row in useraccount (for role + dashboard routing).
-- 2) Adds a safe RPC so "Forgot password" can return "Email not found" without exposing the whole table.

-- Enable RLS
ALTER TABLE public.useraccount ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "useraccount_select_own" ON public.useraccount;
CREATE POLICY "useraccount_select_own"
  ON public.useraccount
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Optional: allow inserts/updates only via service role / backend later — no anon policies here.

-- Forgot-password: check email exists without listing rows
CREATE OR REPLACE FUNCTION public.check_email_registered(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.useraccount WHERE lower(trim(email)) = lower(trim(p_email))
  );
$$;

REVOKE ALL ON FUNCTION public.check_email_registered(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_registered(text) TO anon, authenticated;
