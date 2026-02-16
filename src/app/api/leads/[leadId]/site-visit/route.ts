import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { LeadStage, SITE_VISIT_STATUSES, SiteVisitStatus } from "@/lib/domain";
import { getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

const siteVisitInputSchema = z.object({
  status: z.enum(SITE_VISIT_STATUSES),
  scheduled_for: z.string().datetime({ offset: true }).optional().nullable(),
  completed_at: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(2_000).optional().nullable(),
});

type LeadLookupRow = {
  id: string;
  stage: LeadStage;
  customer_name: string | null;
};

type SiteVisitInsertRow = {
  id: string;
};

function toNullableIsoDate(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function stageFromSiteVisit(status: SiteVisitStatus, currentStage: LeadStage): LeadStage {
  if (currentStage === "closed" || currentStage === "lost") {
    return currentStage;
  }

  if (status === "scheduled") return "visit_scheduled";
  if (status === "completed") return "visit_done";

  if (currentStage === "visit_done") {
    return currentStage;
  }

  return "contacted";
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.toLowerCase().includes("missing supabase configuration")) {
    return NextResponse.json({ ok: false, error: "Server is not configured" }, { status: 503 });
  }

  return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
): Promise<NextResponse> {
  try {
    const parsedParams = paramsSchema.parse(await params);
    const input = siteVisitInputSchema.parse(await request.json());
    const supabase = getSupabaseServerClient();

    if (input.status === "scheduled" && !input.scheduled_for) {
      return NextResponse.json(
        {
          ok: false,
          error: "scheduled_for is required when status is scheduled",
        },
        { status: 400 },
      );
    }

    const leadResponse = await supabase
      .from("leads")
      .select("id,stage,customer_name")
      .eq("id", parsedParams.leadId)
      .maybeSingle();
    throwIfSupabaseError("Unable to load lead", leadResponse.error);

    const lead = leadResponse.data as LeadLookupRow | null;
    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const nextStage = stageFromSiteVisit(input.status, lead.stage);
    const nowIso = new Date().toISOString();
    const completedAtIso =
      input.status === "completed" ? toNullableIsoDate(input.completed_at) ?? nowIso : toNullableIsoDate(input.completed_at);

    const siteVisitResponse = await supabase
      .from("site_visits")
      .insert({
        id: randomUUID(),
        created_at: nowIso,
        updated_at: nowIso,
        lead_id: lead.id,
        status: input.status,
        scheduled_for: toNullableIsoDate(input.scheduled_for),
        completed_at: completedAtIso,
        notes: input.notes?.trim() || null,
      })
      .select("id")
      .single();
    throwIfSupabaseError("Unable to create site visit", siteVisitResponse.error);

    const siteVisit = siteVisitResponse.data as SiteVisitInsertRow | null;
    if (!siteVisit) {
      throw new Error("Unable to create site visit: no row returned");
    }

    const leadUpdateResponse = await supabase
      .from("leads")
      .update({
        stage: nextStage,
      })
      .eq("id", lead.id)
      .select("id")
      .single();
    throwIfSupabaseError("Unable to update lead stage", leadUpdateResponse.error);

    if (input.status === "completed") {
      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + 24);
      const followUpNowIso = new Date().toISOString();

      const followUpResponse = await supabase.from("follow_ups").insert({
        id: randomUUID(),
        created_at: followUpNowIso,
        updated_at: followUpNowIso,
        lead_id: lead.id,
        due_at: dueAt.toISOString(),
        channel: "call",
        message: `Post-visit follow-up for ${lead.customer_name || "lead"}`,
      });
      throwIfSupabaseError("Unable to create post-visit follow-up", followUpResponse.error);
    }

    return NextResponse.json(
      {
        ok: true,
        data: {
          siteVisitId: siteVisit.id,
          leadId: lead.id,
          stage: nextStage,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid site-visit payload",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("site-visit update failed", error);
    return errorResponse(error);
  }
}
