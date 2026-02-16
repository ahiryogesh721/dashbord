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

type LeadFilters = {
  stage?: LeadStage;
  interestLabel?: InterestLabel;
  assignedTo?: string;
};

function applyLeadFilters<T extends { eq: (column: string, value: string) => T }>(query: T, filters: LeadFilters): T {
  let filteredQuery = query;
  if (filters.stage) filteredQuery = filteredQuery.eq("stage", filters.stage);
  if (filters.interestLabel) filteredQuery = filteredQuery.eq("interest_label", filters.interestLabel);
  if (filters.assignedTo) filteredQuery = filteredQuery.eq("assigned_to", filters.assignedTo);
  return filteredQuery;
}

async function countLeadsWithFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  filters: LeadFilters,
): Promise<number> {
  const countResponse = await applyLeadFilters(supabase.from("leads").select("id", { count: "exact", head: true }), filters);

  if (!countResponse.error) {
    return countResponse.count ?? 0;
  }

  console.warn("Unable to count leads via exact count; falling back to paged count", countResponse.error.message);

  const pageSize = 1000;
  let total = 0;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const pageResponse = await applyLeadFilters(supabase.from("leads").select("id").range(from, to), filters);
    throwIfSupabaseError("Unable to count leads", pageResponse.error);

    const rows = pageResponse.data ?? [];
    total += rows.length;

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return total;
}

function emptyLeadsResponse(page: number, pageSize: number, reason: string): NextResponse {
  return NextResponse.json({
    ok: true,
    degraded: true,
    reason,
    data: {
      page,
      pageSize,
      total: 0,
      totalPages: 0,
      leads: [],
    },
  });
}

async function getLeadRowsWithFallback(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  filters: LeadFilters,
  page: number,
  pageSize: number,
): Promise<LeadRow[]> {
  let leadsQuery = supabase
    .from("leads")
    .select("id,created_at,customer_name,phone,score,interest_label,stage,source,assigned_to")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  leadsQuery = applyLeadFilters(leadsQuery, filters);
  const leadsResponse = await leadsQuery;
  throwIfSupabaseError("Unable to load lead list", leadsResponse.error);

  return (leadsResponse.data ?? []) as LeadRow[];
}

async function loadSalesRepsById(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  leadRows: LeadRow[],
): Promise<Map<string, { name: string; email: string | null }>> {
  const assignedRepIds = Array.from(
    new Set(leadRows.map((lead) => lead.assigned_to).filter((repId): repId is string => Boolean(repId))),
  );

  const repById = new Map<string, { name: string; email: string | null }>();
  if (assignedRepIds.length === 0) {
    return repById;
  }

  const repsResponse = await supabase.from("sales_reps").select("id,name,email").in("id", assignedRepIds);
  if (repsResponse.error) {
    console.warn("Unable to load assigned sales reps; returning lead rows without rep details", repsResponse.error.message);
    return repById;
  }

  for (const rep of (repsResponse.data ?? []) as SalesRepRow[]) {
    repById.set(rep.id, { name: rep.name, email: rep.email });
  }

  return repById;
}

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

  try {
    const supabase = getSupabaseServerClient();
    const filters: LeadFilters = { stage, interestLabel, assignedTo };

    const [total, leadRows] = await Promise.all([
      countLeadsWithFallback(supabase, filters),
      getLeadRowsWithFallback(supabase, filters, page, pageSize),
    ]);

    const repById = await loadSalesRepsById(supabase, leadRows);

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
  } catch (error) {
    console.error("dashboard leads endpoint failed; returning degraded response", error);
    return emptyLeadsResponse(page, pageSize, "lead_data_unavailable");
  }
}
