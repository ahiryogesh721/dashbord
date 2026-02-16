-- Normalize phone values to a canonical +digits format.
UPDATE "leads"
SET "phone" = '+' || regexp_replace("phone", '\\D', '', 'g')
WHERE "phone" IS NOT NULL
  AND regexp_replace("phone", '\\D', '', 'g') <> '';

-- Drop unusable/empty phone values.
UPDATE "leads"
SET "phone" = NULL
WHERE "phone" IS NOT NULL
  AND regexp_replace("phone", '\\D', '', 'g') = '';

-- Re-point follow-ups from duplicate leads to the oldest lead per phone.
WITH ranked AS (
  SELECT
    "id",
    "phone",
    FIRST_VALUE("id") OVER (PARTITION BY "phone" ORDER BY "created_at" ASC, "id" ASC) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY "phone" ORDER BY "created_at" ASC, "id" ASC) AS rn
  FROM "leads"
  WHERE "phone" IS NOT NULL
)
UPDATE "follow_ups" AS f
SET "lead_id" = r.keep_id
FROM ranked AS r
WHERE f."lead_id" = r."id"
  AND r.rn > 1;

-- Re-point site visits from duplicate leads to the oldest lead per phone.
WITH ranked AS (
  SELECT
    "id",
    "phone",
    FIRST_VALUE("id") OVER (PARTITION BY "phone" ORDER BY "created_at" ASC, "id" ASC) AS keep_id,
    ROW_NUMBER() OVER (PARTITION BY "phone" ORDER BY "created_at" ASC, "id" ASC) AS rn
  FROM "leads"
  WHERE "phone" IS NOT NULL
)
UPDATE "site_visits" AS s
SET "lead_id" = r.keep_id
FROM ranked AS r
WHERE s."lead_id" = r."id"
  AND r.rn > 1;

-- Remove duplicate lead rows after dependent rows are reassigned.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "phone" ORDER BY "created_at" ASC, "id" ASC) AS rn
  FROM "leads"
  WHERE "phone" IS NOT NULL
)
DELETE FROM "leads" AS l
USING ranked AS r
WHERE l."id" = r."id"
  AND r.rn > 1;

-- Replace non-unique phone index with unique phone index.
DROP INDEX IF EXISTS "leads_phone_idx";
CREATE UNIQUE INDEX "leads_phone_key" ON "leads"("phone");