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

## n8n workflow recommendation
- Trigger: `Schedule Trigger` (every 5 minutes)
- Action: `HTTP Request`
  - method: `POST`
  - URL: `https://<your-domain>/api/jobs/call-dispatch`
  - header: `Authorization: Bearer <CRON_JOB_SECRET>`

## Operational notes
- No Vercel cron and no GitHub Actions cron are enabled.
- Failed dispatches remain `pending` and are retried on next n8n run.
- You can test manually with:
  - `POST /api/jobs/call-dispatch` (add cron secret header)
