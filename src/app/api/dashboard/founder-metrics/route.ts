import { PostgrestError } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { INTEREST_LABELS, LEAD_STAGES } from "@/lib/domain";
import { fetchAllSupabaseRows, getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";

type ScoreRow = {
  score: number | null;
};

function emptyStageBreakdown(): Record<string, number> {
  return Object.fromEntries(LEAD_STAGES.map((stage) => [stage, 0]));
}

function emptyInterestBreakdown(): Record<string, number> {
  return Object.fromEntries(INTEREST_LABELS.map((label) => [label, 0]));
}

function fallbackMetrics(reason: string): NextResponse {
  return NextResponse.json({
    ok: true,
    degraded: true,
    reason,
    data: {
      totalLeads: 0,
      avgScore: 0,
      conversionRate: 0,
      stageBreakdown: emptyStageBreakdown(),
      interestBreakdown: emptyInterestBreakdown(),
      visits: {
        scheduled: 0,
        completed: 0,
      },
      followUpsDueToday: 0,
    },
  });
}

async function countRowsWithFallback(
  context: string,
  fetchExactCount: () => Promise<{ count: number | null; error: PostgrestError | null }>,
  fetchPage: (from: number, to: number) => Promise<{ data: { id: string }[] | null; error: PostgrestError | null }>,
): Promise<number> {
  const exactCountResponse = await fetchExactCount();
  if (!exactCountResponse.error) {
    return exactCountResponse.count ?? 0;
  }

  console.warn(`${context}: exact count failed, falling back to paginated count`, exactCountResponse.error.message);

  const pageSize = 1000;
  let from = 0;
  let total = 0;

  while (true) {
    const to = from + pageSize - 1;
    const pageResponse = await fetchPage(from, to);
    throwIfSupabaseError(context, pageResponse.error);

    const rows = pageResponse.data ?? [];
    total += rows.length;

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return total;
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = getSupabaseServerClient();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const [totalLeads, closedLeads, scheduledVisits, completedVisits, followUpsDueToday] = await Promise.all([
      countRowsWithFallback(
        "Unable to count total leads",
        async () => await supabase.from("leads").select("id", { count: "exact", head: true }),
        async (from, to) => await supabase.from("leads").select("id").range(from, to),
      ),
      countRowsWithFallback(
        "Unable to count closed leads",
        async () => await supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "closed"),
        async (from, to) => await supabase.from("leads").select("id").eq("stage", "closed").range(from, to),
      ),
      countRowsWithFallback(
        "Unable to count scheduled site visits",
        async () => await supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
        async (from, to) => await supabase.from("site_visits").select("id").eq("status", "scheduled").range(from, to),
      ),
      countRowsWithFallback(
        "Unable to count completed site visits",
        async () => await supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("status", "completed"),
        async (from, to) => await supabase.from("site_visits").select("id").eq("status", "completed").range(from, to),
      ),
      countRowsWithFallback(
        "Unable to count follow-ups due today",
        async () =>
          await supabase
            .from("follow_ups")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending")
            .gte("due_at", startOfToday.toISOString())
            .lt("due_at", endOfToday.toISOString()),
        async (from, to) =>
          await supabase
            .from("follow_ups")
            .select("id")
            .eq("status", "pending")
            .gte("due_at", startOfToday.toISOString())
            .lt("due_at", endOfToday.toISOString())
            .range(from, to),
      ),
    ]);

    const stageCounts = await Promise.all(
      LEAD_STAGES.map(async (stage) =>
        await countRowsWithFallback(
          `Unable to count leads in stage ${stage}`,
          async () => await supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", stage),
          async (from, to) => await supabase.from("leads").select("id").eq("stage", stage).range(from, to),
        ),
      ),
    );
    const stageBreakdown = Object.fromEntries(LEAD_STAGES.map((stage, index) => [stage, stageCounts[index] ?? 0]));

    const interestCounts = await Promise.all(
      INTEREST_LABELS.map(async (label) =>
        await countRowsWithFallback(
          `Unable to count leads with interest label ${label}`,
          async () => await supabase.from("leads").select("id", { count: "exact", head: true }).eq("interest_label", label),
          async (from, to) => await supabase.from("leads").select("id").eq("interest_label", label).range(from, to),
        ),
      ),
    );
    const interestBreakdown = Object.fromEntries(INTEREST_LABELS.map((label, index) => [label, interestCounts[index] ?? 0]));

    const scoreRows = await fetchAllSupabaseRows<ScoreRow>(
      "Unable to load scores for average calculation",
      async (from, to) => await supabase.from("leads").select("score").not("score", "is", null).range(from, to),
    );
    const numericScores = scoreRows.map((row) => row.score).filter((score): score is number => typeof score === "number");
    const scoreSum = numericScores.reduce((sum, score) => sum + score, 0);
    const avgScore = numericScores.length > 0 ? Number((scoreSum / numericScores.length).toFixed(2)) : 0;

    const conversionRate = totalLeads > 0 ? Number(((closedLeads / totalLeads) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      ok: true,
      data: {
        totalLeads,
        avgScore,
        conversionRate,
        stageBreakdown,
        interestBreakdown,
        visits: {
          scheduled: scheduledVisits,
          completed: completedVisits,
        },
        followUpsDueToday,
      },
    });
  } catch (error) {
    console.error("founder-metrics failed; returning degraded response", error);
    return fallbackMetrics("metrics_unavailable");
  }
}
