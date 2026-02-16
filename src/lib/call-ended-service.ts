import { randomUUID } from "node:crypto";

import { InterestLabel, LeadStage } from "@/lib/domain";
import { buildFollowUpMessage, followUpDueAt, initialLeadStage } from "@/lib/lifecycle";
import { normalizeCallEndedPayload } from "@/lib/call-ended-payload";
import { normalizeCustomerNameToEnglish, normalizeGoalToEnglish, normalizeVisitSchedule } from "@/lib/call-ended-normalization";
import { scoreLead } from "@/lib/lead-scoring";
import { containsHindi, translateHindiToEnglish } from "@/lib/myHelpers";
import { assignSalesRep } from "@/lib/sales-assignment";
import { getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";
import { Json } from "@/lib/supabase-types";

function parseCallDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nullableText(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

async function toEnglishOnlyText({
  englishValue,
  sourceValue,
  fieldName,
}: {
  englishValue?: string | null;
  sourceValue?: string | null;
  fieldName: "customer_name" | "goal";
}): Promise<string | null> {
  const preferredValue = nullableText(englishValue);
  if (preferredValue && !containsHindi(preferredValue)) return preferredValue;

  const source = nullableText(sourceValue) ?? preferredValue;
  if (!source) return null;

  if (!containsHindi(source)) {
    return source;
  }

  try {
    const translated = await translateHindiToEnglish(source);
    return nullableText(translated);
  } catch (error) {
    //  Keep DB English-only: do not store Hindi text when translation fails.
    console.warn(`Failed to translate ${fieldName} to English`, error);
    return null;
  }
}

type ProcessedCallEndedEvent = {
  leadId: string;
  score: number;
  interestLabel: InterestLabel;
  stage: LeadStage;
  assignedTo: string | null;
  assignmentStrategy: "least_loaded" | "overflow_least_loaded" | "no_active_rep";
  followUpId: string;
  followUpDueAt: string;
};

type InsertedLeadRow = {
  id: string;
  score: number | null;
  interest_label: InterestLabel | null;
  stage: LeadStage;
  assigned_to: string | null;
  customer_name: string | null;
};

type InsertedFollowUpRow = {
  id: string;
  due_at: string;
};

export async function processCallEndedEvent(input: unknown): Promise<ProcessedCallEndedEvent> {
  const payload = normalizeCallEndedPayload(input);
  const report = payload.call_report ?? {};
  const extracted = report.extracted_variables ?? {};
  const supabase = getSupabaseServerClient();

  const normalizedCustomerName = normalizeCustomerNameToEnglish({
    customerName: extracted.customer_name,
    customerNameEnglish: extracted.customer_name_en,
  });
  const normalizedGoal = normalizeGoalToEnglish({
    goal: extracted.property_use,
    goalEnglish: extracted.property_use_en,
  });

  const [customerName, goal] = await Promise.all([
    toEnglishOnlyText({
      englishValue: normalizedCustomerName,
      sourceValue: extracted.customer_name,
      fieldName: "customer_name",
    }),
    toEnglishOnlyText({
      englishValue: normalizedGoal,
      sourceValue: extracted.property_use,
      fieldName: "goal",
    }),
  ]);

  const visitSchedule = normalizeVisitSchedule({
    rawVisitTime: extracted.visit_time,
    englishVisitTime: extracted.visit_time_en,
    visitDate: extracted.visit_date,
    visitDateTime: extracted.visit_datetime,
  });

  const scoreResult = scoreLead({
    transcript: report.transcript,
    summary: report.summary,
    goal,
    visitTime: visitSchedule.visitDateTime ?? visitSchedule.englishText ?? visitSchedule.rawText,
    duration: payload.call_duration,
  });

  const stage = initialLeadStage(visitSchedule.visitDateTime ?? visitSchedule.visitDate ?? visitSchedule.englishText);
  const dueAt = followUpDueAt({
    interestLabel: scoreResult.interestLabel,
    stage,
  });
  const assignment = await assignSalesRep();
  const rawPayload = JSON.parse(JSON.stringify(payload)) as Json;
  const nowIso = new Date().toISOString();
  const leadId = randomUUID();

  const { data: leadData, error: leadError } = await supabase
    .from("leads")
    .insert({
      id: leadId,
      created_at: nowIso,
      updated_at: nowIso,
      call_date: parseCallDate(payload.call_date),
      customer_name: customerName,
      phone: nullableText(payload.to_number),
      goal,
      preference: nullableText(extracted.layout_preference),
      visit_time: nullableText(visitSchedule.englishText ?? visitSchedule.rawText),
      visit_date: visitSchedule.visitDate,
      visit_datetime: visitSchedule.visitDateTime,
      summary: nullableText(report.summary),
      recording_url: nullableText(report.recording_url),
      duration: payload.call_duration ?? null,
      score: scoreResult.score,
      interest_label: scoreResult.interestLabel,
      confidence: scoreResult.confidence,
      ai_reason: scoreResult.reason,
      stage,
      assigned_to: assignment.salesRepId,
      source: "voice_ai",
      raw_payload: rawPayload,
    })
    .select("id,score,interest_label,stage,assigned_to,customer_name")
    .single();
  throwIfSupabaseError("Failed to create lead", leadError);

  if (!leadData) {
    throw new Error("Failed to create lead: no row returned");
  }

  const lead = leadData as InsertedLeadRow;
  const followUpId = randomUUID();
  const followUpNowIso = new Date().toISOString();
  const { data: followUpData, error: followUpError } = await supabase
    .from("follow_ups")
    .insert({
      id: followUpId,
      created_at: followUpNowIso,
      updated_at: followUpNowIso,
      lead_id: lead.id,
      rep_id: assignment.salesRepId,
      due_at: dueAt.toISOString(),
      channel: "whatsapp",
      message: buildFollowUpMessage(lead.customer_name),
    })
    .select("id,due_at")
    .single();

  if (followUpError) {
    await supabase.from("leads").delete().eq("id", lead.id);
    throw new Error(`Failed to create follow-up: ${followUpError.message}`);
  }

  if (!followUpData) {
    await supabase.from("leads").delete().eq("id", lead.id);
    throw new Error("Failed to create follow-up: no row returned");
  }

  const followUp = followUpData as InsertedFollowUpRow;

  return {
    leadId: lead.id,
    score: lead.score ?? 0,
    interestLabel: lead.interest_label ?? "cold",
    stage: lead.stage,
    assignedTo: lead.assigned_to,
    assignmentStrategy: assignment.strategy,
    followUpId: followUp.id,
    followUpDueAt: new Date(followUp.due_at).toISOString(),
  };
}
