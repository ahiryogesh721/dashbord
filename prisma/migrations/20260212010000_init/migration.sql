CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'visit_scheduled', 'visit_done', 'closed', 'lost');
CREATE TYPE "InterestLabel" AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE "SiteVisitStatus" AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'completed', 'skipped', 'cancelled');

CREATE TABLE "sales_reps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "name" TEXT NOT NULL,
  "email" TEXT UNIQUE,
  "phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "max_open_leads" INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE "leads" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "call_date" TIMESTAMP,
  "customer_name" TEXT,
  "phone" TEXT,
  "goal" TEXT,
  "preference" TEXT,
  "visit_time" TEXT,
  "summary" TEXT,
  "recording_url" TEXT,
  "duration" INTEGER,
  "score" INTEGER,
  "interest_label" "InterestLabel",
  "confidence" DOUBLE PRECISION,
  "ai_reason" TEXT,
  "stage" "LeadStage" NOT NULL DEFAULT 'new',
  "assigned_to" UUID,
  "source" TEXT NOT NULL DEFAULT 'voice_ai',
  "raw_payload" JSONB,
  CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "site_visits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lead_id" UUID NOT NULL,
  "rep_id" UUID,
  "scheduled_for" TIMESTAMP,
  "completed_at" TIMESTAMP,
  "status" "SiteVisitStatus" NOT NULL DEFAULT 'scheduled',
  "notes" TEXT,
  CONSTRAINT "site_visits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "site_visits_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "follow_ups" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lead_id" UUID NOT NULL,
  "rep_id" UUID,
  "due_at" TIMESTAMP NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  "message" TEXT,
  "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
  "completed_at" TIMESTAMP,
  CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "follow_ups_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "leads_phone_idx" ON "leads"("phone");
CREATE INDEX "leads_stage_idx" ON "leads"("stage");
CREATE INDEX "leads_score_idx" ON "leads"("score");
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");

CREATE INDEX "sales_reps_is_active_idx" ON "sales_reps"("is_active");

CREATE INDEX "site_visits_lead_id_idx" ON "site_visits"("lead_id");
CREATE INDEX "site_visits_rep_id_idx" ON "site_visits"("rep_id");
CREATE INDEX "site_visits_status_idx" ON "site_visits"("status");

CREATE INDEX "follow_ups_lead_id_status_due_at_idx" ON "follow_ups"("lead_id", "status", "due_at");
CREATE INDEX "follow_ups_rep_id_status_idx" ON "follow_ups"("rep_id", "status");
