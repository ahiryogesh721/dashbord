import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { dispatchOmniCall } from "@/lib/omni";
import { getSupabaseAdminClient, getSupabaseAdminRuntimeInfo, throwIfSupabaseError } from "@/lib/supabase-server";
import { Json } from "@/lib/supabase-types";

const ACTIVE_LEAD_STAGES = ["new", "contacted", "visit_scheduled"] as const;
const DISPATCH_BATCH_SIZE = 1;
const FOLLOW_UP_SEED_BATCH_SIZE = 1;
const SEED_CANDIDATE_SCAN_LIMIT = 400;
let hasValidatedDispatchDbAccess = false;
let hasLoggedDispatchRuntimeInfo = false;

type LeadRow = {
  id: string;
  created_at: string;
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
  // `N8N_DISPATCH_SECRET` is the preferred name.
  // Keep `CRON_JOB_SECRET` as a backward-compatible fallback.
  const secret = process.env.N8N_DISPATCH_SECRET ?? process.env.CRON_JOB_SECRET;
  if (secret === undefined) return true;

  const normalizedSecret = secret.trim();
  if (!normalizedSecret) return false;

  const authHeader = request.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const xSecret = request.headers.get("x-n8n-secret") ?? request.headers.get("x-cron-secret");

  return bearer === normalizedSecret || xSecret === normalizedSecret;
}

function buildRawPayloadWithDispatchMeta(existing: Json | null, details: Record<string, string | null>): Json {
  const current = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};

  return {
    ...current,
    dispatch: {
      last_attempt_at: details.last_attempt_at,
      last_success_at: details.last_success_at,
      last_request_id: details.last_request_id,
      strategy: "n8n_due_followup",
    },
  };
}

function runtimeInfoForLogs(): ReturnType<typeof getSupabaseAdminRuntimeInfo> | { unavailable: true; reason: string } {
  try {
    return getSupabaseAdminRuntimeInfo();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown runtime info error";
    return { unavailable: true, reason };
  }
}

function logDispatchRuntimeInfoOnce(runtime: ReturnType<typeof getSupabaseAdminRuntimeInfo>): void {
  if (hasLoggedDispatchRuntimeInfo) return;
  hasLoggedDispatchRuntimeInfo = true;
  console.info("call-dispatch auth context", runtime);
}

async function validateDispatchDbAccess(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  runtime: ReturnType<typeof getSupabaseAdminRuntimeInfo>,
): Promise<void> {
  if (hasValidatedDispatchDbAccess) return;

  const [leadsAccess, followUpsAccess] = await Promise.all([
    supabase.from("leads").select("id").limit(1),
    supabase.from("follow_ups").select("id").limit(1),
  ]);

  if (leadsAccess.error || followUpsAccess.error) {
    const message = leadsAccess.error?.message ?? followUpsAccess.error?.message ?? "Unknown permission check error";

    throw new Error(
      `Call-dispatch DB permission check failed: ${message} [supabase_auth_role=${runtime.authRole}; key_source=${runtime.keySource}; privileged=${runtime.isPrivileged}]`,
    );
  }

  hasValidatedDispatchDbAccess = true;
}

async function seedFollowUpsForUncalledLeads(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  runtime: ReturnType<typeof getSupabaseAdminRuntimeInfo>,
): Promise<number> {

  const leadsResponse = await supabase
    .from("leads")
    .select("id,phone,customer_name,stage,call_date")
    .is("call_date", null)
    .in("stage", [...ACTIVE_LEAD_STAGES])
    .not("phone", "is", null)
    .order("created_at", { ascending: true })
    .limit(SEED_CANDIDATE_SCAN_LIMIT);

  throwIfSupabaseError("Unable to load uncalled leads", leadsResponse.error, runtime);

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

  throwIfSupabaseError("Unable to load existing follow-ups", existingFollowUpsResponse.error, runtime);

  const followUpRows = (existingFollowUpsResponse.data ?? []) as FollowUpLeadIdRow[];
  const hasFollowUp = new Set(followUpRows.map((row) => row.lead_id));
  const leadsToSeed = leads.filter((lead) => !hasFollowUp.has(lead.id)).slice(0, FOLLOW_UP_SEED_BATCH_SIZE);

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

  throwIfSupabaseError("Unable to seed follow-ups for uncalled leads", insertResponse.error, runtime);
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

  try {
    const supabase = getSupabaseAdminClient({
      context: "call-dispatch",
    });
    const runtime = getSupabaseAdminRuntimeInfo();
    logDispatchRuntimeInfoOnce(runtime);
    await validateDispatchDbAccess(supabase, runtime);

    const nowIso = new Date().toISOString();
    let seededFollowUps = 0;
    try {
      seededFollowUps = await seedFollowUpsForUncalledLeads(supabase, runtime);
    } catch (error) {
      console.error("Unable to seed follow-ups; continuing with existing pending items", {
        runtime: runtimeInfoForLogs(),
        error,
      });
    }

    const dueFollowUpsResponse = await supabase
      .from("follow_ups")
      .select("id,lead_id,due_at,status")
      .eq("status", "pending")
      .eq("channel", "voice_call")
      .lte("due_at", nowIso)
      .order("due_at", { ascending: true })
      .limit(DISPATCH_BATCH_SIZE);

    throwIfSupabaseError("Unable to load due follow-ups", dueFollowUpsResponse.error, runtime);

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
      .select("id,created_at,customer_name,phone,source,call_date,stage,raw_payload")
      .in("id", leadIds);

    throwIfSupabaseError("Unable to load lead records", leadsResponse.error, runtime);

    const leads = (leadsResponse.data ?? []) as LeadRow[];
    const leadById = new Map(leads.map((lead) => [lead.id, lead]));
    const orderedDueFollowUps = [...dueFollowUps].sort((a, b) => {
      const leadA = leadById.get(a.lead_id);
      const leadB = leadById.get(b.lead_id);

      const createdAtA = leadA?.created_at ? new Date(leadA.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      const createdAtB = leadB?.created_at ? new Date(leadB.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (createdAtA !== createdAtB) return createdAtA - createdAtB;

      const dueAtA = new Date(a.due_at).getTime();
      const dueAtB = new Date(b.due_at).getTime();
      if (dueAtA !== dueAtB) return dueAtA - dueAtB;

      return a.id.localeCompare(b.id);
    });

    let processed = 0;
    let dispatched = 0;
    let skipped = 0;
    let failed = 0;

    for (const followUp of orderedDueFollowUps) {
      processed += 1;
      const lead = leadById.get(followUp.lead_id);

      if (!lead?.phone || lead.stage === "closed" || lead.stage === "lost") {
        const skippedResponse = await supabase
          .from("follow_ups")
          .update({
            status: "skipped",
            completed_at: nowIso,
          })
          .eq("id", followUp.id)
          .eq("status", "pending");

        if (skippedResponse.error) {
          failed += 1;
          console.error(`Unable to mark follow-up ${followUp.id} as skipped`, skippedResponse.error);
        } else {
          skipped += 1;
        }

        continue;
      }

      try {
        const dispatchAt = new Date().toISOString();
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
            completed_at: dispatchAt,
            channel: "voice_call",
            message: `Call dispatched via n8n at ${new Date().toISOString()}`,
          })
          .eq("id", followUp.id)
          .eq("status", "pending");

        if (followUpUpdateResponse.error) {
          failed += 1;
          console.error(`Unable to mark follow-up ${followUp.id} as completed`, followUpUpdateResponse.error);
          continue;
        }

        const payloadUpdate = buildRawPayloadWithDispatchMeta(lead.raw_payload, {
          last_attempt_at: dispatchAt,
          last_success_at: dispatchAt,
          last_request_id: omniResult.requestId,
        });

        const leadUpdateResponse = await supabase
          .from("leads")
          .update({
            raw_payload: payloadUpdate,
          })
          .eq("id", lead.id);

        if (leadUpdateResponse.error) {
          failed += 1;
          console.error(`Unable to update dispatch metadata for lead ${lead.id}`, leadUpdateResponse.error);
          continue;
        }

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
    console.error("call-dispatch failed", {
      runtime: runtimeInfoForLogs(),
      error,
    });
    return NextResponse.json({ ok: false, error: "Dispatch failed" }, { status: 500 });
  }
}
