import { LeadStage, Prisma } from "@prisma/client";

const OPEN_STAGES = [LeadStage.new, LeadStage.contacted, LeadStage.visit_scheduled];

export type SalesAssignmentResult = {
  salesRepId: string | null;
  strategy: "least_loaded" | "overflow_least_loaded" | "no_active_rep";
};

export async function assignSalesRep(tx: Prisma.TransactionClient): Promise<SalesAssignmentResult> {
  const reps = await tx.salesRep.findMany({
    where: { isActive: true },
    select: { id: true, maxOpenLeads: true },
    orderBy: { createdAt: "asc" },
  });

  if (!reps.length) {
    return { salesRepId: null, strategy: "no_active_rep" };
  }

  const loads = await tx.lead.groupBy({
    by: ["assignedTo"],
    where: {
      assignedTo: { in: reps.map((rep) => rep.id) },
      stage: { in: OPEN_STAGES },
    },
    _count: { _all: true },
  });

  const loadByRep = new Map<string, number>();
  for (const load of loads) {
    if (load.assignedTo) {
      loadByRep.set(load.assignedTo, load._count._all);
    }
  }

  const eligible = reps.filter((rep) => (loadByRep.get(rep.id) ?? 0) < rep.maxOpenLeads);
  const pool = eligible.length > 0 ? eligible : reps;

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
