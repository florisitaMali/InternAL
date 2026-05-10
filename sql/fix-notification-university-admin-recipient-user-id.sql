-- Optional one-time fix after deploying backend that uses useraccount.user_id as notification.recipient_id
-- for UNIVERSITY_ADMIN (instead of university_id). Run only if you already have collaboration rows inserted
-- with the old recipient_id scheme and want existing notifications to appear for admins.

UPDATE public.notification AS n
SET recipient_id = u.user_id
FROM public.useraccount AS u
WHERE n.recipient_role = 'UNIVERSITY_ADMIN'
  AND u.role = 'UNIVERSITY_ADMIN'
  AND COALESCE(u."isActive", true) = true
  AND u.linked_entity_id IS NOT NULL
  AND u.linked_entity_id = n.recipient_id
  AND n.recipient_id <> u.user_id;
