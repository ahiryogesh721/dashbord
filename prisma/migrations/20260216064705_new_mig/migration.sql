-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'visit_scheduled', 'visit_done', 'closed', 'lost');

-- CreateEnum
CREATE TYPE "InterestLabel" AS ENUM ('hot', 'warm', 'cold');

-- CreateEnum
CREATE TYPE "SiteVisitStatus" AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'completed', 'skipped', 'cancelled');

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "call_date" TIMESTAMP(3),
    "customer_name" TEXT,
    "phone" TEXT,
    "goal" TEXT,
    "preference" TEXT,
    "visit_time" TEXT,
    "visit_date" DATE,
    "visit_datetime" TIMESTAMP(3),
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

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_reps" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_open_leads" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "sales_reps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_visits" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lead_id" UUID NOT NULL,
    "rep_id" UUID,
    "scheduled_for" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "SiteVisitStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,

    CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lead_id" UUID NOT NULL,
    "rep_id" UUID,
    "due_at" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "message" TEXT,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_phone_idx" ON "leads"("phone");

-- CreateIndex
CREATE INDEX "leads_stage_idx" ON "leads"("stage");

-- CreateIndex
CREATE INDEX "leads_score_idx" ON "leads"("score");

-- CreateIndex
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");

-- CreateIndex
CREATE INDEX "leads_visit_date_idx" ON "leads"("visit_date");

-- CreateIndex
CREATE INDEX "leads_visit_datetime_idx" ON "leads"("visit_datetime");

-- CreateIndex
CREATE UNIQUE INDEX "sales_reps_email_key" ON "sales_reps"("email");

-- CreateIndex
CREATE INDEX "sales_reps_is_active_idx" ON "sales_reps"("is_active");

-- CreateIndex
CREATE INDEX "site_visits_lead_id_idx" ON "site_visits"("lead_id");

-- CreateIndex
CREATE INDEX "site_visits_rep_id_idx" ON "site_visits"("rep_id");

-- CreateIndex
CREATE INDEX "site_visits_status_idx" ON "site_visits"("status");

-- CreateIndex
CREATE INDEX "follow_ups_lead_id_status_due_at_idx" ON "follow_ups"("lead_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_rep_id_status_idx" ON "follow_ups"("rep_id", "status");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "sales_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
