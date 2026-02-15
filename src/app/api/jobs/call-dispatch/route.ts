import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { dispatchOmniCall } from "@/lib/omni";
import { getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";
import { Json } from "@/lib/supabase-types";

const ACTIVE_LEAD_STAGES = ["new", "contacted", "visit_scheduled"] as const;
const CALL_BATCH_SIZE = 20;

type LeadRow = {
  id: string;
  customer_name: string | null;
  phone: string | null;
  source: string;
  call_date: string | null;
  stage: string;
  raw_payload: Json | null;
};

type FollowUpRow = {
  id: string;
  lead_id: string;
  due_at: string;
  status: string;
};

type FollowUpLeadIdRow = {
  lead_id: string;
};

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_JOB_SECRET;
  if (!secret) return true;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const xSecret = request.headers.get("x-cron-secret");

  return bearer === secret || xSecret === secret;
}

function buildRawPayloadWithDispatchMeta(existing: Json | null, details: Record<string, string | null>): Json {
  const current = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};

  return {
    ...current,
    dispatch: {
      last_attempt_at: details.last_attempt_at,
      last_success_at: details.last_success_at,
      last_request_id: details.last_request_id,
      strategy: "cron_due_followup",
    },
  };
}

async function seedFollowUpsForUncalledLeads(): Promise<number> {
  const supabase = getSupabaseServerClient();

  const leadsResponse = await supabase
    .from("leads")
    .select("id,phone,customer_name,stage,call_date")
    .is("call_date", null)
    .in("stage", [...ACTIVE_LEAD_STAGES])
    .not("phone", "is", null)
    .order("created_at", { ascending: true })
    .limit(CALL_BATCH_SIZE);

  throwIfSupabaseError("Unable to load uncalled leads", leadsResponse.error);

  const leads = (leadsResponse.data ?? []) as Array<{
    id: string;
    phone: string | null;
    customer_name: string | null;
    stage: string;
    call_date: string | null;
  }>;

  if (leads.length === 0) return 0;

  const leadIds = leads.map((lead) => lead.id);
  const existingFollowUpsResponse = await supabase
    .from("follow_ups")
    .select("lead_id")
    .in("lead_id", leadIds)
    .in("status", ["pending", "completed"]);

  throwIfSupabaseError("Unable to load existing follow-ups", existingFollowUpsResponse.error);

  const followUpRows = (existingFollowUpsResponse.data ?? []) as FollowUpLeadIdRow[];
  const hasFollowUp = new Set(followUpRows.map((row) => row.lead_id));
  const leadsToSeed = leads.filter((lead) => !hasFollowUp.has(lead.id));

  if (leadsToSeed.length === 0) return 0;

  const now = new Date().toISOString();
  const insertResponse = await supabase.from("follow_ups").insert(
    leadsToSeed.map((lead) => ({
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      lead_id: lead.id,
      due_at: now,
      channel: "voice_call",
      message: `Initial outbound call for ${lead.customer_name || "lead"}`,
      status: "pending" as const,
    })),
  );

  throwIfSupabaseError("Unable to seed follow-ups for uncalled leads", insertResponse.error);
  return leadsToSeed.length;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return runDispatch(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runDispatch(request);
}

async function runDispatch(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  try {
    const seededFollowUps = await seedFollowUpsForUncalledLeads();

    const dueFollowUpsResponse = await supabase
      .from("follow_ups")
      .select("id,lead_id,due_at,status")
      .eq("status", "pending")
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(CALL_BATCH_SIZE);

    throwIfSupabaseError("Unable to load due follow-ups", dueFollowUpsResponse.error);

    const dueFollowUps = (dueFollowUpsResponse.data ?? []) as FollowUpRow[];
    if (dueFollowUps.length === 0) {
      return NextResponse.json({
        ok: true,
        data: {
          seededFollowUps,
          processed: 0,
          dispatched: 0,
          skipped: 0,
          failed: 0,
          message: "No due follow-ups",
        },
      });
    }

    const leadIds = Array.from(new Set(dueFollowUps.map((row) => row.lead_id)));
    const leadsResponse = await supabase
      .from("leads")
      .select("id,customer_name,phone,source,call_date,stage,raw_payload")
      .in("id", leadIds);

    throwIfSupabaseError("Unable to load lead records", leadsResponse.error);

    const leads = (leadsResponse.data ?? []) as LeadRow[];
    const leadById = new Map(leads.map((lead) => [lead.id, lead]));

    let processed = 0;
    let dispatched = 0;
    let skipped = 0;
    let failed = 0;

    for (const followUp of dueFollowUps) {
      processed += 1;
      const lead = leadById.get(followUp.lead_id);

      if (!lead?.phone || lead.stage === "closed" || lead.stage === "lost") {
        skipped += 1;

        const skippedResponse = await supabase
          .from("follow_ups")
          .update({
            status: "skipped",
            completed_at: nowIso,
          })
          .eq("id", followUp.id)
          .eq("status", "pending");

        throwIfSupabaseError(`Unable to mark follow-up ${followUp.id} as skipped`, skippedResponse.error);
        continue;
      }

      try {
        const omniResult = await dispatchOmniCall({
          toNumber: lead.phone,
          customerName: lead.customer_name,
          leadId: lead.id,
          followUpId: followUp.id,
        });

        const followUpUpdateResponse = await supabase
          .from("follow_ups")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            channel: "voice_call",
            message: `Call dispatched via cron at ${new Date().toISOString()}`,
          })
          .eq("id", followUp.id)
          .eq("status", "pending");

        throwIfSupabaseError(`Unable to mark follow-up ${followUp.id} as completed`, followUpUpdateResponse.error);

        const payloadUpdate = buildRawPayloadWithDispatchMeta(lead.raw_payload, {
          last_attempt_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_request_id: omniResult.requestId,
        });

        const leadUpdateResponse = await supabase
          .from("leads")
          .update({
            stage: (lead.stage === "new" ? "contacted" : lead.stage) as "new" | "contacted" | "visit_scheduled" | "visit_done" | "closed" | "lost",
            raw_payload: payloadUpdate,
          })
          .eq("id", lead.id);

        throwIfSupabaseError(`Unable to update dispatch metadata for lead ${lead.id}`, leadUpdateResponse.error);
        dispatched += 1;
      } catch (error) {
        failed += 1;
        console.error(`Dispatch failed for follow-up ${followUp.id}`, error);
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        seededFollowUps,
        processed,
        dispatched,
        skipped,
        failed,
      },
    });
  } catch (error) {
    console.error("call-dispatch cron failed", error);
    return NextResponse.json({ ok: false, error: "Cron dispatch failed" }, { status: 500 });
  }
}
