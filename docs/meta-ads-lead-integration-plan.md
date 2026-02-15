# Meta Ads Lead Integration Plan

## Current flow (testing)
- `n8n` Form Trigger captures `Name` and `Number`.
- Workflow dispatches call via Omni (`/api/v1/calls/dispatch`).
- Omni call end event reaches backend webhook (`POST /api/webhooks/call-ended`).
- Backend creates/updates lead lifecycle records.

## Production target flow (Meta Lead Ads)
1. **Meta Lead Ads webhook ingestion**
   - Create Meta webhook subscription for leadgen.
   - Point webhook to an n8n webhook trigger.
2. **Fetch complete lead payload**
   - Webhook usually sends only `leadgen_id`.
   - Use Meta Graph API (`/{leadgen_id}`) in n8n HTTP Request node to fetch full lead data.
3. **Normalize fields**
   - Map Meta fields into normalized backend shape:
     - `customer_name`
     - `phone`
     - `source = "meta_ads"`
     - optional campaign/adset/ad metadata in `raw_payload`
4. **Create lead in backend**
   - Call backend endpoint (`POST /api/leads/manual`) or a dedicated `POST /api/leads/ingest` endpoint.
5. **Dispatch call**
   - Trigger Omni dispatch using normalized phone and name.
6. **Lifecycle continuation**
   - Omni sends call-ended event to existing backend webhook.
   - Dashboard shows stage movement and performance.

## n8n workflow blueprint
- **Webhook Trigger** (Meta leadgen event)
- **HTTP Request** (Graph API: fetch lead details)
- **Set/Function** (normalize + phone formatting)
- **HTTP Request** (POST backend lead create)
- **HTTP Request** (POST Omni call dispatch)
- Optional: **If** node for retries/failure queues.

## Data fields to store for attribution
- `source = "meta_ads"`
- `raw_payload.campaign_id`
- `raw_payload.campaign_name`
- `raw_payload.adset_id`
- `raw_payload.ad_id`
- `raw_payload.form_id`
- `raw_payload.platform = "meta"`

## Security + reliability checklist
- Move Omni bearer token from workflow JSON into n8n Credentials/Secrets.
- Enable webhook secret validation on backend `call-ended` endpoint.
- Add idempotency key (`leadgen_id`) to prevent duplicate lead creation.
- Add dead-letter/retry path in n8n for temporary API failures.
