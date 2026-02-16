-- Backfill visit_datetime from visit_date when only date-level schedule exists.
UPDATE "leads"
SET "visit_datetime" = ("visit_date"::timestamp + INTERVAL '12 hours')
WHERE "visit_datetime" IS NULL
  AND "visit_date" IS NOT NULL;

-- Remove legacy visit fields. `visit_datetime` remains the single source of truth.
DROP INDEX IF EXISTS "leads_visit_date_idx";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "visit_time";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "visit_date";
