-- Optional one-time migration: university admin notifications use notification.recipient_id = university_id
-- (matches useraccount.linked_entity_id). Run if you previously migrated rows to per-admin user_id via
-- fix-notification-university-admin-recipient-user-id.sql and need them unified again.

UPDATE public.notification AS n
SET recipient_id = u.linked_entity_id
FROM public.useraccount AS u
WHERE n.recipient_role = 'UNIVERSITY_ADMIN'
  AND u.role = 'UNIVERSITY_ADMIN'
  AND u.user_id = n.recipient_id
  AND u.linked_entity_id IS NOT NULL
  AND n.recipient_id <> u.linked_entity_id;
