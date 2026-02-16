-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_assigned_to_fkey";

-- DropForeignKey
ALTER TABLE "site_visits" DROP CONSTRAINT IF EXISTS "site_visits_rep_id_fkey";

-- DropForeignKey
ALTER TABLE "follow_ups" DROP CONSTRAINT IF EXISTS "follow_ups_rep_id_fkey";

-- DropIndex
DROP INDEX IF EXISTS "leads_assigned_to_idx";

-- DropIndex
DROP INDEX IF EXISTS "site_visits_rep_id_idx";

-- DropIndex
DROP INDEX IF EXISTS "follow_ups_rep_id_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "sales_reps_email_key";

-- DropIndex
DROP INDEX IF EXISTS "sales_reps_is_active_idx";

-- DropColumn
ALTER TABLE "leads" DROP COLUMN IF EXISTS "assigned_to";

-- DropColumn
ALTER TABLE "site_visits" DROP COLUMN IF EXISTS "rep_id";

-- DropColumn
ALTER TABLE "follow_ups" DROP COLUMN IF EXISTS "rep_id";

-- DropTable
DROP TABLE IF EXISTS "sales_reps";