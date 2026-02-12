import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { processCallEndedEvent } from "@/lib/call-ended-service";

function verifyWebhookSecret(request: NextRequest): boolean {
  const sharedSecret = process.env.N8N_WEBHOOK_SECRET;
  if (!sharedSecret) return true;

  const incoming = request.headers.get("x-webhook-secret");
  return incoming === sharedSecret;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized webhook request" }, { status: 401 });
    }

    const body = await request.json();
    const result = await processCallEndedEvent(body);

    return NextResponse.json(
      {
        ok: true,
        message: "Lead lifecycle processed",
        data: result,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid call-ended payload",
          details: error.flatten(),
        },
        { status: 400 },
      );
    }

    console.error("call-ended webhook processing failed", error);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
