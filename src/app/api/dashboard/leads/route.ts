import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { INTEREST_LABELS, InterestLabel, LEAD_STAGES, LeadStage } from "@/lib/domain";
import { getSupabaseAdminClient, getSupabaseAdminRuntimeInfo, throwIfSupabaseError } from "@/lib/supabase-server";

const querySchema = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  interest_label: z.enum(INTEREST_LABELS).optional(),
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
};

type LeadFilters = {
  stage?: LeadStage;
  interestLabel?: InterestLabel;
};

type ApiLead = {
  id: string;
  createdAt: string;
  customerName: string | null;
  phone: string | null;
  score: number | null;
  interestLabel: InterestLabel | null;
  stage: LeadStage;
  source: string;
};

function mapLeadRowToApiLead(lead: LeadRow): ApiLead {
  return {
    id: lead.id,
    createdAt: lead.created_at,
    customerName: lead.customer_name,
    phone: lead.phone,
    score: lead.score,
    interestLabel: lead.interest_label,
    stage: lead.stage,
    source: lead.source,
  };
}

function applyLeadFilters<T extends { eq: (column: string, value: string) => T }>(query: T, filters: LeadFilters): T {
  let filteredQuery = query;
  if (filters.stage) filteredQuery = filteredQuery.eq("stage", filters.stage);
  if (filters.interestLabel) filteredQuery = filteredQuery.eq("interest_label", filters.interestLabel);
  return filteredQuery;
}

async function countLeadsWithFallback(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: LeadFilters,
  runtime: ReturnType<typeof getSupabaseAdminRuntimeInfo>,
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
    throwIfSupabaseError("Unable to count leads", pageResponse.error, runtime);

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
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  filters: LeadFilters,
  page: number,
  pageSize: number,
  runtime: ReturnType<typeof getSupabaseAdminRuntimeInfo>,
): Promise<LeadRow[]> {
  let leadsQuery = supabase
    .from("leads")
    .select("id,created_at,customer_name,phone,score,interest_label,stage,source")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  leadsQuery = applyLeadFilters(leadsQuery, filters);
  const leadsResponse = await leadsQuery;
  throwIfSupabaseError("Unable to load lead list", leadsResponse.error, runtime);

  return (leadsResponse.data ?? []) as LeadRow[];
}

function runtimeInfoForLogs(): ReturnType<typeof getSupabaseAdminRuntimeInfo> | { unavailable: true; reason: string } {
  try {
    return getSupabaseAdminRuntimeInfo();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown runtime info error";
    return { unavailable: true, reason };
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    stage: url.searchParams.get("stage") ?? undefined,
    interest_label: url.searchParams.get("interest_label") ?? undefined,
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

  const { stage, interest_label: interestLabel, page, page_size: pageSize } = parsedQuery.data;

  const filters: LeadFilters = { stage, interestLabel };

  try {
    const runtime = getSupabaseAdminRuntimeInfo();
    const supabase = getSupabaseAdminClient({ context: "dashboard-leads" });
    const accessCheck = await supabase.from("leads").select("id").limit(1);
    throwIfSupabaseError("Unable to access leads table", accessCheck.error, runtime);

    const [total, leadRows] = await Promise.all([
      countLeadsWithFallback(supabase, filters, runtime),
      getLeadRowsWithFallback(supabase, filters, page, pageSize, runtime),
    ]);

    const leads = leadRows.map(mapLeadRowToApiLead);

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
    console.error("dashboard leads endpoint failed; returning degraded response", {
      runtime: runtimeInfoForLogs(),
      error,
    });
    return emptyLeadsResponse(page, pageSize, "lead_data_unavailable");
  }
}
