import { randomUUID } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";

import { InterestLabel, LeadStage } from "@/lib/domain";
import { consolidateDuplicateLeadsByPhone } from "@/lib/lead-dedupe";
import { buildFollowUpMessage, followUpDueAt } from "@/lib/lifecycle";
import { CallEndedPayload, normalizeCallEndedPayload } from "@/lib/call-ended-payload";
import { normalizeCustomerNameToEnglish, normalizeGoalToEnglish, normalizeVisitSchedule } from "@/lib/call-ended-normalization";
import { scoreLead } from "@/lib/lead-scoring";
import { containsHindi, translateHindiToEnglish } from "@/lib/myHelpers";
import { deterministicLeadIdFromPhone, normalizePhoneForStorage } from "@/lib/phone";
import { getSupabaseAdminClient, throwIfSupabaseError } from "@/lib/supabase-server";
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

const CONNECTED_HINT_KEYWORDS = [
  "answered",
  "connected",
  "completed",
  "in progress",
  "human",
  "talk",
  "conversation",
];

const NOT_CONNECTED_HINT_KEYWORDS = [
  "rejected",
  "declined",
  "no answer",
  "not answered",
  "unanswered",
  "missed",
  "busy",
  "failed",
  "voicemail",
  "canceled",
  "cancelled",
  "not connected",
  "unreachable",
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeHint(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return normalized || null;
}

function readStringHint(source: Record<string, unknown> | null, key: string): string | null {
  if (!source) return null;
  const value = source[key];
  return typeof value === "string" ? normalizeHint(value) : null;
}

function readBooleanHint(source: Record<string, unknown> | null, key: string): boolean | null {
  if (!source) return null;
  const value = source[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "y", "answered", "connected"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "rejected", "declined", "no answer", "no_answer", "missed", "busy"].includes(normalized)) {
    return false;
  }

  return null;
}

function includesAnyHint(hints: string[], keywords: string[]): boolean {
  return hints.some((hint) => keywords.some((keyword) => hint.includes(keyword)));
}

function stageFromCallOutcome(payload: CallEndedPayload): LeadStage {
  const payloadRecord = asRecord(payload);
  const reportRecord = asRecord(payload.call_report);

  const hintKeys = [
    "status",
    "call_status",
    "callStatus",
    "call_result",
    "result",
    "outcome",
    "disposition",
    "end_reason",
    "hangup_reason",
    "termination_reason",
  ];

  const hints: string[] = [];
  for (const key of hintKeys) {
    const payloadHint = readStringHint(payloadRecord, key);
    if (payloadHint) hints.push(payloadHint);

    const reportHint = readStringHint(reportRecord, key);
    if (reportHint) hints.push(reportHint);
  }

  const answeredHint =
    readBooleanHint(payloadRecord, "answered") ??
    readBooleanHint(payloadRecord, "is_answered") ??
    readBooleanHint(reportRecord, "answered") ??
    readBooleanHint(reportRecord, "is_answered");

  const hasConnectedHint = includesAnyHint(hints, CONNECTED_HINT_KEYWORDS);
  const hasNotConnectedHint = includesAnyHint(hints, NOT_CONNECTED_HINT_KEYWORDS);

  const durationSeconds = typeof payload.call_duration === "number" ? payload.call_duration : null;
  const hasConversationText = Boolean(nullableText(payload.call_report?.transcript) || nullableText(payload.call_report?.summary));

  if (answeredHint === true || hasConnectedHint || hasConversationText || (durationSeconds !== null && durationSeconds > 0)) {
    return "contacted";
  }

  if (answeredHint === false || hasNotConnectedHint || durationSeconds === 0) {
    return "closed";
  }

  return "closed";
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
  followUpId: string;
  followUpDueAt: string;
};

type InsertedLeadRow = {
  id: string;
  score: number | null;
  interest_label: InterestLabel | null;
  stage: LeadStage;
  customer_name: string | null;
};

type InsertedFollowUpRow = {
  id: string;
  due_at: string;
};

function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === "23505";
}

export async function processCallEndedEvent(input: unknown): Promise<ProcessedCallEndedEvent> {
  const payload = normalizeCallEndedPayload(input);
  const report = payload.call_report ?? {};
  const extracted = report.extracted_variables ?? {};
  const supabase = getSupabaseAdminClient({ context: "call-ended" });

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

  const stage = stageFromCallOutcome(payload);
  const dueAt = followUpDueAt({
    interestLabel: scoreResult.interestLabel,
    stage,
  });
  const rawPayload = JSON.parse(JSON.stringify(payload)) as Json;
  const nowIso = new Date().toISOString();
  const normalizedPhone = normalizePhoneForStorage(payload.to_number);
  if (!normalizedPhone) {
    throw new Error("Failed to process call-ended event: missing valid to_number");
  }
  const leadPayload = {
    updated_at: nowIso,
    call_date: parseCallDate(payload.call_date),
    phone: normalizedPhone,
    goal,
    preference: nullableText(extracted.layout_preference),
    visit_datetime: visitSchedule.visitDateTime,
    summary: nullableText(report.summary),
    recording_url: nullableText(report.recording_url),
    duration: payload.call_duration ?? null,
    score: scoreResult.score,
    interest_label: scoreResult.interestLabel,
    confidence: scoreResult.confidence,
    ai_reason: scoreResult.reason,
    stage,
    raw_payload: rawPayload,
  };
  const insertLeadPayload = {
    ...leadPayload,
    customer_name: customerName,
  };

  const existingLeadId = await consolidateDuplicateLeadsByPhone(supabase, normalizedPhone, "call-ended");
  const isNewLead = !existingLeadId;
  const leadInsertId = existingLeadId ?? deterministicLeadIdFromPhone(normalizedPhone);
  let createdLeadThisRequest = false;

  let leadData: InsertedLeadRow | null = null;
  if (isNewLead) {
    const insertResponse = await supabase
      .from("leads")
      .insert({
        id: leadInsertId,
        created_at: nowIso,
        source: "voice_ai",
        ...insertLeadPayload,
      })
      .select("id,score,interest_label,stage,customer_name")
      .single();

    if (insertResponse.error && isUniqueViolation(insertResponse.error)) {
      // Concurrent webhook or previously existing phone row won the race.
      const recoveredLeadId = await consolidateDuplicateLeadsByPhone(supabase, normalizedPhone, "call-ended-recover");
      if (!recoveredLeadId) {
        throw new Error("Failed to recover lead after unique violation");
      }

      const updateResponse = await supabase
        .from("leads")
        .update(leadPayload)
        .eq("id", recoveredLeadId)
        .select("id,score,interest_label,stage,customer_name")
        .single();

      throwIfSupabaseError("Failed to recover and update lead after unique violation", updateResponse.error);
      leadData = (updateResponse.data ?? null) as InsertedLeadRow | null;
    } else {
      throwIfSupabaseError("Failed to create lead", insertResponse.error);
      leadData = (insertResponse.data ?? null) as InsertedLeadRow | null;
      createdLeadThisRequest = true;
    }
  } else {
    const updateResponse = await supabase
      .from("leads")
      .update(leadPayload)
      .eq("id", leadInsertId)
      .select("id,score,interest_label,stage,customer_name")
      .single();
    throwIfSupabaseError("Failed to update lead", updateResponse.error);
    leadData = (updateResponse.data ?? null) as InsertedLeadRow | null;
  }

  if (!leadData) {
    throw new Error(isNewLead ? "Failed to create lead: no row returned" : "Failed to update lead: no row returned");
  }
  const lead = leadData;
  const followUpId = randomUUID();
  const followUpNowIso = new Date().toISOString();
  const { data: followUpData, error: followUpError } = await supabase
    .from("follow_ups")
    .insert({
      id: followUpId,
      created_at: followUpNowIso,
      updated_at: followUpNowIso,
      lead_id: lead.id,
      due_at: dueAt.toISOString(),
      channel: "whatsapp",
      message: buildFollowUpMessage(lead.customer_name),
    })
    .select("id,due_at")
    .single();

  if (followUpError) {
    if (createdLeadThisRequest) {
      await supabase.from("leads").delete().eq("id", lead.id);
    }
    throw new Error(`Failed to create follow-up: ${followUpError.message}`);
  }

  if (!followUpData) {
    if (createdLeadThisRequest) {
      await supabase.from("leads").delete().eq("id", lead.id);
    }
    throw new Error("Failed to create follow-up: no row returned");
  }

  const followUp = followUpData as InsertedFollowUpRow;

  return {
    leadId: lead.id,
    score: lead.score ?? 0,
    interestLabel: lead.interest_label ?? "cold",
    stage: lead.stage,
    followUpId: followUp.id,
    followUpDueAt: new Date(followUp.due_at).toISOString(),
  };
}
