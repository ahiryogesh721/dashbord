# Call Dispatch API (n8n-scheduled mode)

This project keeps the call dispatch logic in backend, but **does not run any platform cron jobs**.
All scheduling should be handled by n8n for now.

## Scheduling source
- n8n should run every 5 minutes (or your preferred interval).
- n8n calls: `POST /api/jobs/call-dispatch`.

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
- Route requires `N8N_DISPATCH_SECRET` when configured (fallback: `CRON_JOB_SECRET`).
- Secret can be sent in either:
  - `Authorization: Bearer <secret>`
  - `x-n8n-secret: <secret>` (legacy: `x-cron-secret`)

## Required environment variables
- `N8N_DISPATCH_SECRET` (recommended; fallback `CRON_JOB_SECRET`)
- `OMNI_URL` (preferred; example: `https://backend.omnidim.io/api/v1/calls/dispatch`) or `OMNI_BASE_URL`
- `OMNI_API_KEY`
- `OMNI_AGENT_ID`
- Optional `OMNI_FROM_NUMBER_ID` (defaults to `1720`)
- Existing Supabase env vars used by this project (`SUPABASE_URL` + key)

## n8n workflow recommendation
- Trigger: `Schedule Trigger` (every 5 minutes)
- Action: `HTTP Request`
  - method: `POST`
  - URL: `https://<your-domain>/api/jobs/call-dispatch`
  - header: `Authorization: Bearer <N8N_DISPATCH_SECRET>`
- Ready import file: `n8nWorkfllows/DB Poll - Call Dispatch Every 5 Min.json`

## Operational notes
- No Vercel cron and no GitHub Actions cron are enabled.
- Failed dispatches remain `pending` and are retried on next n8n run.
- You can test manually with:
  - `POST /api/jobs/call-dispatch` (add dispatch secret header)
