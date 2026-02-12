# Deploy to Vercel (Next.js + Prisma)

This project can be deployed directly to Vercel. It needs a PostgreSQL database and two environment variables.

## 1) Prerequisites

- A Git repository with this project pushed (GitHub/GitLab/Bitbucket)
- A PostgreSQL database (Neon, Supabase, Railway, RDS, etc.)
- A Vercel account

## 2) Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma
- `N8N_WEBHOOK_SECRET`: shared secret expected in `x-webhook-secret` header

Example keys only (do not use real secrets in docs):

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
N8N_WEBHOOK_SECRET=your-long-random-secret
```

## 3) Create the Vercel Project

1. Go to Vercel -> `Add New...` -> `Project`
2. Import your repository
3. Keep framework as `Next.js` (auto-detected)
4. Add the two environment variables above
5. Click `Deploy`

## 4) Run Prisma Migrations in Production

After the first deploy, run migrations against your production database once:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
npx prisma migrate deploy
```

If this is a fresh database, seed initial sales reps:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
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
- For schema changes, run again:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB?schema=public"
npx prisma migrate deploy
```

