import { LeadStage, SiteVisitStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { prisma } from "@/lib/prisma";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

const siteVisitInputSchema = z.object({
  status: z.nativeEnum(SiteVisitStatus),
  scheduled_for: z.string().datetime({ offset: true }).optional().nullable(),
  completed_at: z.string().datetime({ offset: true }).optional().nullable(),
  notes: z.string().max(2_000).optional().nullable(),
  rep_id: z.string().uuid().optional().nullable(),
});

function toNullableDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function stageFromSiteVisit(status: SiteVisitStatus): LeadStage {
  if (status === SiteVisitStatus.scheduled) return LeadStage.visit_scheduled;
  if (status === SiteVisitStatus.completed) return LeadStage.visit_done;
  return LeadStage.contacted;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> },
): Promise<NextResponse> {
  try {
    const parsedParams = paramsSchema.parse(await params);
    const input = siteVisitInputSchema.parse(await request.json());

    const lead = await prisma.lead.findUnique({
      where: { id: parsedParams.leadId },
      select: { id: true, assignedTo: true, customerName: true },
    });

    if (!lead) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    const repId = input.rep_id ?? lead.assignedTo ?? null;
    const nextStage = stageFromSiteVisit(input.status);

    const siteVisit = await prisma.siteVisit.create({
      data: {
        leadId: lead.id,
        repId,
        status: input.status,
        scheduledFor: toNullableDate(input.scheduled_for),
        completedAt: toNullableDate(input.completed_at),
        notes: input.notes?.trim() || null,
      },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage: nextStage,
      },
    });

    if (input.status === SiteVisitStatus.completed) {
      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + 24);

      await prisma.followUp.create({
        data: {
          leadId: lead.id,
          repId,
          dueAt,
          channel: "call",
          message: `Post-visit follow-up for ${lead.customerName || "lead"}`,
        },
      });
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
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
