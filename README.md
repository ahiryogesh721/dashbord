# Real Estate Voice AI Backend

Next.js + Supabase backend for lead lifecycle, scoring, assignment, visits, follow-ups, and dashboard metrics.

## Core Features

- Call-ended webhook ingestion with schema validation
- Lead scoring (`0-100`) and interest tagging (`hot` / `warm` / `cold`)
- Sales rep assignment (least-loaded strategy)
- Site visit tracking and follow-up scheduling
- Manual lead creation endpoint
- n8n-triggered call dispatch endpoint for Omni
- Founder dashboard APIs + UI

## API Routes

- `POST /api/webhooks/call-ended`
- `GET /api/jobs/call-dispatch`
- `POST /api/jobs/call-dispatch`
- `POST /api/leads/manual`
- `POST /api/leads/:leadId/site-visit`
- `GET /api/dashboard/founder-metrics`
- `GET /api/dashboard/leads`

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Copy env template and fill minimal values.

```bash
cp .env.example .env
```

3. Generate Prisma client.

```bash
npm run prisma:generate
```

4. Apply DB migrations.

```bash
npx prisma migrate deploy
```

5. Seed initial sales reps.

```bash
npm run prisma:seed
```

6. Run local server.

```bash
npm run dev
```

## Minimal Environment Variables

- `DATABASE_URL` (for Prisma commands)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `OMNI_URL` (preferred) or `OMNI_BASE_URL` (fallback)
- `OMNI_API_KEY`
- `OMNI_AGENT_ID`
- `OMNI_FROM_NUMBER_ID` (optional; defaults to `1720`)

Optional hardening variables:
- `SUPABASE_SERVICE_ROLE_KEY`
- `N8N_WEBHOOK_SECRET`
- `N8N_DISPATCH_SECRET` (or legacy `CRON_JOB_SECRET`)

`OPENAI_API_KEY` is optional and only needed for Hindi-to-English translation fallback.

## n8n Integration

Forward call-ended events to:

- `POST {NEXT_APP_URL}/api/webhooks/call-ended`
- Optional header: `x-webhook-secret: <N8N_WEBHOOK_SECRET>` (only if you configured that secret)

If using n8n for dispatch triggering, call:

- `POST {NEXT_APP_URL}/api/jobs/call-dispatch`
- Optional header: `Authorization: Bearer <N8N_DISPATCH_SECRET>` (only if you configured that secret)
