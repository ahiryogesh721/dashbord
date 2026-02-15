# Cron + API Route Call Dispatch (Option A)

This project now supports a backend-driven 5-minute calling engine without requiring n8n for dispatch orchestration.

## What runs every 5 minutes
- Vercel Cron hits: `GET /api/jobs/call-dispatch`.
- Schedule is defined in `vercel.json`.

## Route behavior
The route performs two phases:

1. **Seed follow-ups for uncalled leads**
   - Finds leads in active stages (`new`, `contacted`, `visit_scheduled`) with `call_date IS NULL` and a phone number.
   - For leads that do not yet have a pending/completed follow-up, it creates an immediate pending follow-up.

2. **Dispatch due follow-ups**
   - Loads `follow_ups` where `status = pending` and `due_at <= now`.
   - Loads related lead rows.
   - Skips invalid leads (no phone / closed / lost).
   - Calls Omni dispatch API for valid entries.
   - Marks successful follow-ups as `completed` and stamps `completed_at`.
   - Updates lead metadata (`raw_payload.dispatch.*`) and moves stage from `new` to `contacted` on successful dispatch.

## Security
- Route requires `CRON_JOB_SECRET` when configured.
- Secret can be sent in either:
  - `Authorization: Bearer <secret>`
  - `x-cron-secret: <secret>`

## Required environment variables
- `CRON_JOB_SECRET` (recommended)
- `OMNI_BASE_URL` (example: `https://backend.omnidim.io`)
- `OMNI_API_KEY`
- `OMNI_AGENT_ID`
- `OMNI_FROM_NUMBER_ID`
- Existing Supabase env vars used by this project (`SUPABASE_URL` + key)

## How this works with existing lifecycle logic
- Existing webhook flow still processes call-ended payloads.
- Existing follow-up rows continue to drive recall behavior (`due_at`, `status`).
- Cron route simply executes due work and dispatches calls.

## Operational notes
- This is idempotent enough for single cron execution cadence, but for high concurrency you should add stronger DB-level claiming/locking.
- Failed dispatches currently remain `pending` and will be retried on the next run.
- You can test manually with:
  - `POST /api/jobs/call-dispatch` (add cron secret header).


## GitHub Actions alternative (no Vercel Pro cron required)
You can trigger the same endpoint every 5 minutes using GitHub Actions.

- Workflow file: `.github/workflows/call-dispatch-cron.yml`
- Schedule: `*/5 * * * *`
- Method: `POST /api/jobs/call-dispatch`
- Auth header: `Authorization: Bearer <CRON_JOB_SECRET>`

### GitHub repository secrets to set
- `CALL_DISPATCH_URL` = `https://<your-domain>/api/jobs/call-dispatch`
- `CRON_JOB_SECRET` = same secret configured in deployment env

### Notes
- Includes `workflow_dispatch` so you can run it manually from GitHub Actions UI.
- Fails the run if HTTP status is not 2xx.
- Run logs include endpoint response body for easier debugging.
