-- Run in Supabase SQL editor (or psql) before deploying backend that writes collaboration_status / opportunity_id.
-- collaboration_status: PENDING until university admin approves; APPROVED students may see listing; REJECTED hidden.

ALTER TABLE public.opportunitytarget
  ADD COLUMN IF NOT EXISTS collaboration_status text NOT NULL DEFAULT 'APPROVED';

COMMENT ON COLUMN public.opportunitytarget.collaboration_status IS 'PENDING | APPROVED | REJECTED';

-- Existing rows: treat as already approved (current behaviour). New rows from API get PENDING explicitly.
UPDATE public.opportunitytarget SET collaboration_status = 'APPROVED' WHERE collaboration_status IS NULL;

ALTER TABLE public.notification
  ADD COLUMN IF NOT EXISTS opportunity_id integer REFERENCES public.opportunity (opportunity_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notification_opportunity_id ON public.notification (opportunity_id) WHERE opportunity_id IS NOT NULL;
