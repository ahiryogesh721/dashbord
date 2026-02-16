import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";
import { ZodError, z } from "zod";

import { INTEREST_LABELS } from "@/lib/domain";
import { consolidateDuplicateLeadsByPhone } from "@/lib/lead-dedupe";
import { deterministicLeadIdFromPhone, normalizePhoneForStorage } from "@/lib/phone";
import { getSupabaseAdminClient, getSupabaseAdminRuntimeInfo, throwIfSupabaseError } from "@/lib/supabase-server";

const createLeadSchema = z.object({
  customer_name: z.string().trim().min(1).max(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, "Phone must contain 7-15 digits and may start with +"),
  source: z.string().trim().min(2).max(80).default("manual"),
  goal: z.string().trim().max(250).optional().nullable(),
  preference: z.string().trim().max(250).optional().nullable(),
  interest_label: z.enum(INTEREST_LABELS).optional().nullable(),
});

type InsertedLeadRow = {
  id: string;
  created_at: string;
  customer_name: string | null;
  phone: string | null;
  source: string;
  stage: string;
  interest_label: string | null;
  goal: string | null;
  preference: string | null;
};

function isUniqueViolation(error: PostgrestError | null): boolean {
  return error?.code === "23505";
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const lower = message.toLowerCase();

  if (
    lower.includes("missing supabase configuration") ||
    lower.includes("missing supabase admin configuration") ||
    lower.includes("supabase admin client requires privileged credentials")
  ) {
    return NextResponse.json({ ok: false, error: "Server is not configured" }, { status: 503 });
  }

  if (lower.includes("permission denied") || lower.includes("insufficient_privilege")) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Write access is blocked by current Supabase auth/policies. Configure RLS for publishable key usage or provide server write credentials.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json();
    const input = createLeadSchema.parse(body);
    const cleanedPhone = normalizePhoneForStorage(input.phone);
    if (!cleanedPhone) {
      return NextResponse.json({ ok: false, error: "Invalid phone number" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    const runtime = getSupabaseAdminRuntimeInfo();
    const supabase = getSupabaseAdminClient({ context: "manual-lead-create" });
    const existingLeadId = await consolidateDuplicateLeadsByPhone(supabase, cleanedPhone, "manual-lead");

    if (existingLeadId) {
      const updateResponse = await supabase
        .from("leads")
        .update({
          updated_at: nowIso,
          customer_name: input.customer_name,
          source: input.source,
          goal: input.goal ?? null,
          preference: input.preference ?? null,
          interest_label: input.interest_label ?? null,
          raw_payload: {
            created_via: "manual_dashboard_form",
            submitted_at: nowIso,
          },
        })
        .eq("id", existingLeadId)
        .select("id,created_at,customer_name,phone,source,stage,interest_label,goal,preference")
        .single();

      throwIfSupabaseError("Unable to update existing manual lead", updateResponse.error, runtime);
      return NextResponse.json({ ok: true, data: updateResponse.data as InsertedLeadRow }, { status: 200 });
    }

    const insertResponse = await supabase
      .from("leads")
      .insert({
        id: deterministicLeadIdFromPhone(cleanedPhone),
        created_at: nowIso,
        updated_at: nowIso,
        customer_name: input.customer_name,
        phone: cleanedPhone,
        source: input.source,
        goal: input.goal ?? null,
        preference: input.preference ?? null,
        interest_label: input.interest_label ?? null,
        stage: "new" as const,
        raw_payload: {
          created_via: "manual_dashboard_form",
          submitted_at: nowIso,
        },
      })
      .select("id,created_at,customer_name,phone,source,stage,interest_label,goal,preference")
      .single();

    if (insertResponse.error && isUniqueViolation(insertResponse.error)) {
      const recoveredLeadId = await consolidateDuplicateLeadsByPhone(supabase, cleanedPhone, "manual-lead-recover");
      if (!recoveredLeadId) {
        throw new Error("Unable to recover manual lead after unique violation");
      }

      const recoverUpdateResponse = await supabase
        .from("leads")
        .update({
          updated_at: nowIso,
          customer_name: input.customer_name,
          source: input.source,
          goal: input.goal ?? null,
          preference: input.preference ?? null,
          interest_label: input.interest_label ?? null,
          raw_payload: {
            created_via: "manual_dashboard_form",
            submitted_at: nowIso,
          },
        })
        .eq("id", recoveredLeadId)
        .select("id,created_at,customer_name,phone,source,stage,interest_label,goal,preference")
        .single();

      throwIfSupabaseError("Unable to recover and update manual lead", recoverUpdateResponse.error, runtime);
      return NextResponse.json({ ok: true, data: recoverUpdateResponse.data as InsertedLeadRow }, { status: 200 });
    }

    throwIfSupabaseError("Unable to create manual lead", insertResponse.error, runtime);
    return NextResponse.json({ ok: true, data: insertResponse.data as InsertedLeadRow }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid lead input",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("manual lead creation failed", error);
    return errorResponse(error);
  }
}
