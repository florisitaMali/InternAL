-- Optional: who triggered the notification (for avatar + label in the UI).
-- Run once on your Supabase/Postgres database.
-- sender_role values should match app roles: STUDENT, COMPANY, PPA, UNIVERSITY_ADMIN

ALTER TABLE public.notification
  ADD COLUMN IF NOT EXISTS sender_role character varying,
  ADD COLUMN IF NOT EXISTS sender_id integer;

COMMENT ON COLUMN public.notification.sender_role IS 'Role of the actor who caused the notification (matches useraccount.role labels).';
COMMENT ON COLUMN public.notification.sender_id IS 'Entity id for the sender (student_id, company_id, ppa_id, or university_id depending on sender_role).';
