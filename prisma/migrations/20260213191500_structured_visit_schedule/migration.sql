ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "visit_date" DATE;
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "visit_datetime" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "leads_visit_date_idx" ON "leads"("visit_date");
CREATE INDEX IF NOT EXISTS "leads_visit_datetime_idx" ON "leads"("visit_datetime");
