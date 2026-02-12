import { LeadStage } from "@/lib/domain";
import { fetchAllSupabaseRows, getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";

const OPEN_STAGES: LeadStage[] = ["new", "contacted", "visit_scheduled"];

type SalesRepRow = {
  id: string;
  max_open_leads: number;
};

type OpenLeadRow = {
  assigned_to: string | null;
};

export type SalesAssignmentResult = {
  salesRepId: string | null;
  strategy: "least_loaded" | "overflow_least_loaded" | "no_active_rep";
};

export async function assignSalesRep(): Promise<SalesAssignmentResult> {
  const supabase = getSupabaseServerClient();

  const { data: reps, error: repsError } = await supabase
    .from("sales_reps")
    .select("id,max_open_leads,created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  throwIfSupabaseError("Unable to load active sales reps", repsError);

  const activeReps = (reps ?? []) as SalesRepRow[];
  if (!activeReps.length) {
    return { salesRepId: null, strategy: "no_active_rep" };
  }

  const repIds = activeReps.map((rep) => rep.id);
  const openLeadRows = await fetchAllSupabaseRows<OpenLeadRow>(
    "Unable to load open lead assignments",
    async (from, to) =>
      await supabase
        .from("leads")
        .select("assigned_to")
        .in("assigned_to", repIds)
        .in("stage", OPEN_STAGES)
        .range(from, to),
  );

  const loadByRep = new Map<string, number>();
  for (const row of openLeadRows) {
    const assignedTo = row.assigned_to;
    if (assignedTo) {
      loadByRep.set(assignedTo, (loadByRep.get(assignedTo) ?? 0) + 1);
    }
  }

  const eligible = activeReps.filter((rep) => (loadByRep.get(rep.id) ?? 0) < rep.max_open_leads);
  const pool = eligible.length > 0 ? eligible : activeReps;

  pool.sort((a, b) => {
    const loadDiff = (loadByRep.get(a.id) ?? 0) - (loadByRep.get(b.id) ?? 0);
    if (loadDiff !== 0) return loadDiff;
    return a.id.localeCompare(b.id);
  });

  return {
    salesRepId: pool[0]?.id ?? null,
    strategy: eligible.length > 0 ? "least_loaded" : "overflow_least_loaded",
  };
}
