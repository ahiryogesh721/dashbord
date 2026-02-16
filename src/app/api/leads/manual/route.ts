import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { INTEREST_LABELS } from "@/lib/domain";
import { getSupabaseServerClient, throwIfSupabaseError } from "@/lib/supabase-server";

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

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").replace(/-/g, "");
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  const lower = message.toLowerCase();

  if (lower.includes("missing supabase configuration")) {
    return NextResponse.json({ ok: false, error: "Server is not configured" }, { status: 503 });
  }

  if (lower.includes("permission denied") || lower.includes("insufficient_privilege")) {
    return NextResponse.json(
      {
        ok: false,
        error: "Server write access is not configured. Set a Supabase service role key for backend APIs.",
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

    const supabase = getSupabaseServerClient();

    const cleanedPhone = normalizePhone(input.phone);
    const nowIso = new Date().toISOString();
    const payload = {
      id: randomUUID(),
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
    };

    const response = await supabase
      .from("leads")
      .insert(payload)
      .select("id,created_at,customer_name,phone,source,stage,interest_label,goal,preference")
      .single();

    throwIfSupabaseError("Unable to create manual lead", response.error);

    return NextResponse.json({ ok: true, data: response.data as InsertedLeadRow }, { status: 201 });
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
