ALTER TABLE "leads"
ADD COLUMN "visit_date" DATE,
ADD COLUMN "visit_datetime" TIMESTAMPTZ;

CREATE INDEX "leads_visit_date_idx" ON "leads"("visit_date");
CREATE INDEX "leads_visit_datetime_idx" ON "leads"("visit_datetime");
