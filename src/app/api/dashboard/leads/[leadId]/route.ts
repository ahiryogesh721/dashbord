import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdminClient, getSupabaseAdminRuntimeInfo, throwIfSupabaseError } from "@/lib/supabase-server";

const paramsSchema = z.object({
  leadId: z.string().uuid(),
});

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
        error: "Database permissions are misconfigured for Supabase service role.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ leadId: string }> },
): Promise<NextResponse> {
  try {
    const { leadId } = paramsSchema.parse(await params);
    const runtime = getSupabaseAdminRuntimeInfo();
    const supabase = getSupabaseAdminClient({ context: "dashboard-delete-lead" });

    const deleteResponse = await supabase.from("leads").delete().eq("id", leadId).select("id").maybeSingle();
    throwIfSupabaseError("Unable to delete lead", deleteResponse.error, runtime);

    if (!deleteResponse.data?.id) {
      return NextResponse.json({ ok: false, error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: deleteResponse.data.id,
      },
    });
  } catch (error) {
    console.error("dashboard lead delete failed", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: "Invalid lead id" }, { status: 400 });
    }

    return errorResponse(error);
  }
}
