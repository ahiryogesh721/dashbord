import { NextResponse } from "next/server";

import { INTEREST_LABELS, LEAD_STAGES } from "@/lib/domain";
import { fetchAllSupabaseRows, getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";

type ScoreRow = {
  score: number | null;
};

export async function GET(): Promise<NextResponse> {
  const supabase = getSupabaseServerClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [totalLeadsResponse, closedLeadsResponse, scheduledVisitsResponse, completedVisitsResponse, followUpsDueResponse] =
    await Promise.all([
      supabase.from("leads").select("id", { count: "exact", head: true }),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", "closed"),
      supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
      supabase.from("site_visits").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase
        .from("follow_ups")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gte("due_at", startOfToday.toISOString())
        .lt("due_at", endOfToday.toISOString()),
    ]);

  throwIfSupabaseError("Unable to count total leads", totalLeadsResponse.error);
  throwIfSupabaseError("Unable to count closed leads", closedLeadsResponse.error);
  throwIfSupabaseError("Unable to count scheduled site visits", scheduledVisitsResponse.error);
  throwIfSupabaseError("Unable to count completed site visits", completedVisitsResponse.error);
  throwIfSupabaseError("Unable to count follow-ups due today", followUpsDueResponse.error);

  const totalLeads = totalLeadsResponse.count ?? 0;
  const closedLeads = closedLeadsResponse.count ?? 0;
  const scheduledVisits = scheduledVisitsResponse.count ?? 0;
  const completedVisits = completedVisitsResponse.count ?? 0;
  const followUpsDueToday = followUpsDueResponse.count ?? 0;

  const stageCountResponses = await Promise.all(
    LEAD_STAGES.map((stage) => supabase.from("leads").select("id", { count: "exact", head: true }).eq("stage", stage)),
  );
  const stageBreakdown: Record<string, number> = {};
  for (let index = 0; index < LEAD_STAGES.length; index += 1) {
    const stage = LEAD_STAGES[index];
    const response = stageCountResponses[index];
    throwIfSupabaseError(`Unable to count leads in stage ${stage}`, response.error);
    stageBreakdown[stage] = response.count ?? 0;
  }

  const interestCountResponses = await Promise.all(
    INTEREST_LABELS.map((label) =>
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("interest_label", label),
    ),
  );
  const interestBreakdown: Record<string, number> = {};
  for (let index = 0; index < INTEREST_LABELS.length; index += 1) {
    const label = INTEREST_LABELS[index];
    const response = interestCountResponses[index];
    throwIfSupabaseError(`Unable to count leads with interest label ${label}`, response.error);
    interestBreakdown[label] = response.count ?? 0;
  }

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
}
