import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { INTEREST_LABELS, InterestLabel, LEAD_STAGES, LeadStage } from "@/lib/domain";
import { getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";

const querySchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  interest_label: z.enum(INTEREST_LABELS).optional(),
  assigned_to: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

type LeadRow = {
  id: string;
  created_at: string;
  customer_name: string | null;
  phone: string | null;
  score: number | null;
  interest_label: InterestLabel | null;
  stage: LeadStage;
  source: string;
  assigned_to: string | null;
};

type SalesRepRow = {
  id: string;
  name: string;
  email: string | null;
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    stage: url.searchParams.get("stage") ?? undefined,
    interest_label: url.searchParams.get("interest_label") ?? undefined,
    assigned_to: url.searchParams.get("assigned_to") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    page_size: url.searchParams.get("page_size") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid query params",
        details: parsedQuery.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { stage, interest_label: interestLabel, assigned_to: assignedTo, page, page_size: pageSize } = parsedQuery.data;
  const supabase = getSupabaseServerClient();

  let totalQuery = supabase.from("leads").select("id", { count: "exact", head: true });
  if (stage) totalQuery = totalQuery.eq("stage", stage);
  if (interestLabel) totalQuery = totalQuery.eq("interest_label", interestLabel);
  if (assignedTo) totalQuery = totalQuery.eq("assigned_to", assignedTo);

  let leadsQuery = supabase
    .from("leads")
    .select("id,created_at,customer_name,phone,score,interest_label,stage,source,assigned_to")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (stage) leadsQuery = leadsQuery.eq("stage", stage);
  if (interestLabel) leadsQuery = leadsQuery.eq("interest_label", interestLabel);
  if (assignedTo) leadsQuery = leadsQuery.eq("assigned_to", assignedTo);

  const [totalResponse, leadsResponse] = await Promise.all([totalQuery, leadsQuery]);
  throwIfSupabaseError("Unable to count leads", totalResponse.error);
  throwIfSupabaseError("Unable to load lead list", leadsResponse.error);

  const total = totalResponse.count ?? 0;
  const leadRows = (leadsResponse.data ?? []) as LeadRow[];

  const assignedRepIds = Array.from(
    new Set(leadRows.map((lead) => lead.assigned_to).filter((repId): repId is string => Boolean(repId))),
  );

  const repById = new Map<string, { name: string; email: string | null }>();
  if (assignedRepIds.length > 0) {
    const repsResponse = await supabase.from("sales_reps").select("id,name,email").in("id", assignedRepIds);
    throwIfSupabaseError("Unable to load assigned sales reps", repsResponse.error);

    for (const rep of (repsResponse.data ?? []) as SalesRepRow[]) {
      repById.set(rep.id, { name: rep.name, email: rep.email });
    }
  }

  const leads = leadRows.map((lead) => ({
    id: lead.id,
    createdAt: lead.created_at,
    customerName: lead.customer_name,
    phone: lead.phone,
    score: lead.score,
    interestLabel: lead.interest_label,
    stage: lead.stage,
    source: lead.source,
    assignedTo: lead.assigned_to,
    salesRep: lead.assigned_to ? repById.get(lead.assigned_to) ?? null : null,
  }));

  return NextResponse.json({
    ok: true,
    data: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      leads,
    },
  });
}

