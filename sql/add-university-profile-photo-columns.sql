-- Match the company table: store public URLs from bucket `user-profile-photo` after upload.
-- Storage paths (same pattern as company): university/logo/{university_id}.{ext}, university/cover/{university_id}.{ext}

alter table public.university
  add column if not exists logo_url text,
  add column if not exists cover_url text;

alter table public.university
  add column if not exists description text;
