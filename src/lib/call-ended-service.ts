import { Prisma } from "@prisma/client";

import { buildFollowUpMessage, followUpDueAt, initialLeadStage } from "@/lib/lifecycle";
import { normalizeCallEndedPayload } from "@/lib/call-ended-payload";
import { scoreLead } from "@/lib/lead-scoring";
import { prisma } from "@/lib/prisma";
import { assignSalesRep } from "@/lib/sales-assignment";

function parseCallDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function nullableText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

type ProcessedCallEndedEvent = {
  leadId: string;
  score: number;
  interestLabel: "hot" | "warm" | "cold";
  stage: "new" | "contacted" | "visit_scheduled" | "visit_done" | "closed" | "lost";
  assignedTo: string | null;
  assignmentStrategy: "least_loaded" | "overflow_least_loaded" | "no_active_rep";
  followUpId: string;
  followUpDueAt: string;
};

export async function processCallEndedEvent(input: unknown): Promise<ProcessedCallEndedEvent> {
  const payload = normalizeCallEndedPayload(input);
  const report = payload.call_report ?? {};
  const extracted = report.extracted_variables ?? {};

  const scoreResult = scoreLead({
    transcript: report.transcript,
    summary: report.summary,
    goal: extracted.property_use,
    visitTime: extracted.visit_time,
    duration: payload.call_duration,
  });

  const stage = initialLeadStage(extracted.visit_time);
  const dueAt = followUpDueAt({
    interestLabel: scoreResult.interestLabel,
    stage,
  });

  const { lead, followUp, assignmentStrategy } = await prisma.$transaction(async (tx) => {
    const assignment = await assignSalesRep(tx);

    const lead = await tx.lead.create({
      data: {
        callDate: parseCallDate(payload.call_date),
        customerName: nullableText(extracted.customer_name),
        phone: nullableText(payload.to_number),
        goal: nullableText(extracted.property_use),
        preference: nullableText(extracted.layout_preference),
        visitTime: nullableText(extracted.visit_time),
        summary: nullableText(report.summary),
        recordingUrl: nullableText(report.recording_url),
        duration: payload.call_duration ?? null,
        score: scoreResult.score,
        interestLabel: scoreResult.interestLabel,
        confidence: scoreResult.confidence,
        aiReason: scoreResult.reason,
        stage,
        assignedTo: assignment.salesRepId,
        source: "voice_ai",
        rawPayload: payload as Prisma.JsonObject,
      },
    });

    const followUp = await tx.followUp.create({
      data: {
        leadId: lead.id,
        repId: assignment.salesRepId,
        dueAt,
        channel: "whatsapp",
        message: buildFollowUpMessage(lead.customerName),
      },
    });

    return {
      lead,
      followUp,
      assignmentStrategy: assignment.strategy,
    };
  });

  return {
    leadId: lead.id,
    score: lead.score ?? 0,
    interestLabel: lead.interestLabel ?? "cold",
    stage: lead.stage,
    assignedTo: lead.assignedTo,
    assignmentStrategy,
    followUpId: followUp.id,
    followUpDueAt: followUp.dueAt.toISOString(),
  };
}
