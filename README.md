# Real Estate Voice AI Backend

This repository now includes a Next.js backend foundation for moving lead lifecycle logic out of n8n.

## What Is Implemented

- Next.js API backend scaffold (TypeScript, App Router)
- Supabase PostgreSQL-backed data model
- `POST /api/webhooks/call-ended` for n8n handoff
- Lead scoring engine (`0-100`, hot/warm/cold)
- Sales rep assignment (least-loaded active rep)
- Lifecycle initialization and follow-up scheduling
- Site visit tracking endpoint
- Founder metrics and leads dashboard endpoints

## API Routes

- `POST /api/webhooks/call-ended`
- `POST /api/leads/:leadId/site-visit`
- `GET /api/dashboard/founder-metrics`
- `GET /api/dashboard/leads`

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Apply database schema in Supabase:

```bash
# Run SQL from:
# prisma/migrations/20260212010000_init/migration.sql
# prisma/migrations/20260212184149_first_migrant/migration.sql
```

4. Seed sales reps:

```bash
npm run prisma:seed
```

5. Start API server:

```bash
npm run dev
```

## n8n Integration

Update the call-ended workflow to forward payloads to:

- `POST {NEXT_APP_URL}/api/webhooks/call-ended`
- Header: `x-webhook-secret: <N8N_WEBHOOK_SECRET>`

n8n should stay an event router only; business logic runs in Next.js.
