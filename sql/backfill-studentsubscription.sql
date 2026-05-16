-- US-32 — SA Analytics: Student
-- Backfills the existing `studentsubscription` table so every student has exactly
-- one row (Base by default, Premium for students currently flagged hasPremium).
--
-- NO SCHEMA CHANGES — this only inserts/updates data in an existing table.
-- Idempotent: re-running only fills students that still lack a row; the UPDATE
-- re-syncs Premium students. Safe to run multiple times.
--
-- Run once on Supabase before using the Student analytics tab.

-- 1. One Base row for every student that has no subscription row yet.
INSERT INTO public.studentsubscription
    (student_id, plan_tier, billing_cycle, subscription_price,
     subscription_status, started_at, created_at, auto_renew)
SELECT s.student_id, 'BASE', 'NONE', 0,
       'ACTIVE', now(), now(), false
FROM public.student s
WHERE NOT EXISTS (
    SELECT 1 FROM public.studentsubscription ss
    WHERE ss.student_id = s.student_id
);

-- 2. Promote rows to Premium for students currently flagged hasPremium.
--    Existing students have no real Stripe history, so:
--      - billing_cycle defaults to MONTHLY (the only live plan; see US-32 plan),
--      - subscription_price uses the monthly price below — adjust 9.99 to the
--        real Stripe monthly price if it differs.
--    `hasPremium` is a quoted (camel-case) column, hence the double quotes.
UPDATE public.studentsubscription ss
SET plan_tier              = 'PREMIUM',
    billing_cycle          = 'MONTHLY',
    subscription_price     = 9.99,
    subscription_status    = COALESCE(s.premium_subscription_status, 'active'),
    expires_at             = s.premium_current_period_end,
    stripe_subscription_id = s.stripe_subscription_id,
    auto_renew             = true
FROM public.student s
WHERE ss.student_id = s.student_id
  AND s."hasPremium" = true;
