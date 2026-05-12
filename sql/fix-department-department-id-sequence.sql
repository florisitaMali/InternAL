-- Fix Postgres 23505 (duplicate pkey) when inserting via PostgREST: serial sequences are behind MAX(id)
-- after seeds, restores, or manual inserts with explicit ids.
--
-- Run once in Supabase SQL Editor (or psql).

-- department.department_id
SELECT setval(
    pg_get_serial_sequence('public.department', 'department_id'),
    COALESCE((SELECT MAX(department_id) FROM public.department), 0)
);

-- studyfield.field_id (same symptom: "duplicate key value violates unique constraint studyfield_pkey")
SELECT setval(
    pg_get_serial_sequence('public.studyfield', 'field_id'),
    COALESCE((SELECT MAX(field_id) FROM public.studyfield), 0)
);

-- Next INSERT on each table gets MAX(...) + 1 (or 1 if the table is empty).
