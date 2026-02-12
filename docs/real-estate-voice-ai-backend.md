# Real Estate Voice AI Backend Architecture

## Flow

1. User submits lead form in n8n.
2. n8n dispatches Omni call.
3. Omni posts call-ended payload to n8n webhook.
4. n8n forwards event payload to Next.js:
   - `POST /api/webhooks/call-ended`
5. Next.js performs:
   - payload validation
   - scoring (`0-100`)
   - lead persistence
   - sales rep assignment
   - lifecycle stage assignment
   - follow-up scheduling

## Core Data Model

- `leads`: source of truth for lifecycle, score, and assignment
- `sales_reps`: assignment pool and capacity limits
- `site_visits`: scheduled/completed visit trail
- `follow_ups`: pending and completed follow-up queue

## Initial Lifecycle Rules

- Stage:
  - `visit_scheduled` if `visit_time` exists
  - else `new`
- Follow-up due:
  - `visit_scheduled` -> `+6h`
  - `hot` -> `+2h`
  - `warm` -> `+24h`
  - `cold` -> `+72h`
- Assignment:
  - least-loaded active rep by open leads
  - overflow to least-loaded if all reps exceed capacity

## Next Endpoints

- `POST /api/webhooks/call-ended`
- `POST /api/leads/:leadId/site-visit`
- `GET /api/dashboard/founder-metrics`
- `GET /api/dashboard/leads`
