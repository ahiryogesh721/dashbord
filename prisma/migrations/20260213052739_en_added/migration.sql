-- AlterTable (safe for shadow DB replay)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'visit_datetime'
  ) THEN
    ALTER TABLE "leads" ALTER COLUMN "visit_datetime" TYPE TIMESTAMP(3);
  END IF;
END $$;
