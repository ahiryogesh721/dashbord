# Deploy to Vercel (Next.js + Supabase)

This project can be deployed directly to Vercel and uses Supabase Postgres for persistence.

## 1) Prerequisites

- A Git repository with this project pushed (GitHub/GitLab/Bitbucket)
- A Supabase project (or compatible PostgreSQL instance)
- A Vercel account

## 2) Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL`: connection string used by Prisma migrations/seed
- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`: publishable key used by backend Supabase client in minimal setup
- `OMNI_URL` (preferred) or `OMNI_BASE_URL` (fallback)
- `OMNI_API_KEY`, `OMNI_AGENT_ID`
- Optional `OMNI_FROM_NUMBER_ID` (defaults to `1720`)

Optional hardening variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_SECRET`
- `N8N_DISPATCH_SECRET` (legacy fallback: `CRON_JOB_SECRET`)
- Optional for Hindi translation fallback: `OPENAI_API_KEY`

Example keys only (do not use real secrets in docs):

```env
DATABASE_URL=postgresql://user:password@host:5432/postgres?sslmode=require
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-publishable-key
OMNI_URL=https://backend.omnidim.io/api/v1/calls/dispatch
OMNI_API_KEY=your-omni-api-key
OMNI_AGENT_ID=your-omni-agent-id
OMNI_FROM_NUMBER_ID=1720
```

## 3) Create the Vercel Project

1. Go to Vercel -> `Add New...` -> `Project`
2. Import your repository
3. Keep framework as `Next.js` (auto-detected)
4. Add the environment variables above
5. Click `Deploy`

## 4) Apply Schema + Seed

Run migrations from this repo so schema stays in sync:

```powershell
npx prisma migrate deploy
```

Then seed initial sales reps:

```powershell
npm run prisma:seed
```

## 5) Point n8n to Vercel

Update n8n webhook target to:

- `POST https://<your-vercel-domain>/api/webhooks/call-ended`
- Optional header: `x-webhook-secret: <same value as N8N_WEBHOOK_SECRET>` if secret is configured

## 6) Verify Deployment

1. Open `https://<your-vercel-domain>/api/dashboard/founder-metrics`
2. Send a test webhook to `/api/webhooks/call-ended`
3. Confirm new lead/follow-up records in your database

## 7) Ongoing Deploys

- Code push -> Vercel auto-deploys
- For schema changes, run `npx prisma migrate deploy` against the target database before or during release.

### Important: remove legacy Vercel cron configuration

If you previously deployed with a `crons` config, Vercel may still show cron notices until the project is redeployed with the current repo state and any old cron jobs are removed in Vercel dashboard.

- Vercel Project -> Settings -> Cron Jobs -> remove old entries
- Redeploy latest commit (this repo now ships `vercel.json` with no `crons`)

## 8) Scheduler

For now, scheduling should run from n8n (not Vercel cron/GitHub Actions cron):

- n8n schedule every 5 minutes
- n8n HTTP request -> `POST https://<your-domain>/api/jobs/call-dispatch`
- Optional header: `Authorization: Bearer <N8N_DISPATCH_SECRET>` if secret is configured
