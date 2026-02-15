# Deploy to Vercel (Next.js + Supabase)

This project can be deployed directly to Vercel. It uses Supabase Postgres through Supabase API credentials.

## 1) Prerequisites

- A Git repository with this project pushed (GitHub/GitLab/Bitbucket)
- A PostgreSQL database (Neon, Supabase, Railway, RDS, etc.)
- A Vercel account

## 2) Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: server-side key for API routes (recommended)
- Optional fallback: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `N8N_WEBHOOK_SECRET`: shared secret expected in `x-webhook-secret` header

Example keys only (do not use real secrets in docs):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
N8N_WEBHOOK_SECRET=your-long-random-secret
```

## 3) Create the Vercel Project

1. Go to Vercel -> `Add New...` -> `Project`
2. Import your repository
3. Keep framework as `Next.js` (auto-detected)
4. Add the required environment variables above
5. Click `Deploy`

## 4) Apply Schema + Seed in Supabase

For a fresh Supabase project, apply SQL migrations in Supabase SQL Editor:

- `prisma/migrations/20260212010000_init/migration.sql`
- `prisma/migrations/20260212184149_first_migrant/migration.sql`

If this is a fresh database, seed initial sales reps:

```powershell
npm run prisma:seed
```

## 5) Point n8n to Vercel

Update n8n webhook target to:

- `POST https://<your-vercel-domain>/api/webhooks/call-ended`
- Header: `x-webhook-secret: <same value as N8N_WEBHOOK_SECRET>`

## 6) Verify Deployment

1. Open `https://<your-vercel-domain>/api/dashboard/founder-metrics`
2. Send a test webhook to `/api/webhooks/call-ended`
3. Confirm new lead/follow-up records in your database

## 7) Ongoing Deploys

- Code push -> Vercel auto-deploys
- For schema changes, run new SQL migrations in Supabase and redeploy.



### Important: remove legacy Vercel cron configuration

If you previously deployed with a `crons` config, Vercel may still show cron notices until the project is redeployed with the current repo state and any old cron jobs are removed in Vercel dashboard.

- Vercel Project → Settings → Cron Jobs → remove old entries
- Redeploy latest commit (this repo now ships `vercel.json` with no `crons`)

## 8) Scheduler

For now, scheduling should run from n8n (not Vercel cron/GitHub Actions cron):

- n8n schedule every 5 minutes
- n8n HTTP request -> `POST https://<your-domain>/api/jobs/call-dispatch`
- Header: `Authorization: Bearer <CRON_JOB_SECRET>`
