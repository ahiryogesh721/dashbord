# Real Estate Voice AI Backend

This repository now includes a Next.js backend foundation for moving lead lifecycle logic out of n8n.

## What Is Implemented

- Next.js API backend scaffold (TypeScript, App Router)
- Prisma + PostgreSQL data model
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

3. Generate Prisma client:

```bash
npm run prisma:generate
```

4. Run migrations:

```bash
npm run prisma:migrate
```

5. Seed sales reps:

```bash
npm run prisma:seed
```

6. Start API server:

```bash
npm run dev
```

## n8n Integration

Update the call-ended workflow to forward payloads to:

- `POST {NEXT_APP_URL}/api/webhooks/call-ended`
- Header: `x-webhook-secret: <N8N_WEBHOOK_SECRET>`

n8n should stay an event router only; business logic runs in Next.js.
