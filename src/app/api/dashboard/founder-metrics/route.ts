import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [
    totalLeads,
    avgScoreResult,
    closedLeads,
    stageBreakdownRows,
    interestBreakdownRows,
    scheduledVisits,
    completedVisits,
    followUpsDueToday,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.aggregate({ _avg: { score: true } }),
    prisma.lead.count({ where: { stage: "closed" } }),
    prisma.lead.groupBy({ by: ["stage"], _count: { _all: true } }),
    prisma.lead.groupBy({ by: ["interestLabel"], _count: { _all: true } }),
    prisma.siteVisit.count({ where: { status: "scheduled" } }),
    prisma.siteVisit.count({ where: { status: "completed" } }),
    prisma.followUp.count({
      where: {
        status: "pending",
        dueAt: {
          gte: startOfToday,
          lt: endOfToday,
        },
      },
    }),
  ]);

  const stageBreakdown: Record<string, number> = {};
  for (const row of stageBreakdownRows) {
    stageBreakdown[row.stage] = row._count._all;
  }

  const interestBreakdown: Record<string, number> = {};
  for (const row of interestBreakdownRows) {
    if (row.interestLabel) {
      interestBreakdown[row.interestLabel] = row._count._all;
    }
  }

  const avgScore = avgScoreResult._avg.score ? Number(avgScoreResult._avg.score.toFixed(2)) : 0;
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
