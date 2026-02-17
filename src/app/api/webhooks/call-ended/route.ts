import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { processCallEndedEvent } from "@/lib/call-ended-service";

type DispatchTriggerResult = {
  attempted: boolean;
  ok: boolean;
  status: number | null;
  error: string | null;
};

function secretsMatch(expected: string, incoming: string | null): boolean {
  if (!incoming) return false;

  const expectedBuffer = Buffer.from(expected);
  const incomingBuffer = Buffer.from(incoming);
  if (expectedBuffer.length !== incomingBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, incomingBuffer);
}

function verifyWebhookSecret(request: NextRequest): boolean {
  const sharedSecret = process.env.N8N_WEBHOOK_SECRET;
  if (sharedSecret === undefined) return true;

  const normalizedSecret = sharedSecret.trim();
  if (!normalizedSecret) return false;

  const incoming = request.headers.get("x-webhook-secret");
  return secretsMatch(normalizedSecret, incoming);
}

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (message.toLowerCase().includes("missing supabase configuration")) {
    return NextResponse.json({ ok: false, error: "Server is not configured" }, { status: 503 });
  }

  return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

async function triggerNextCallDispatch(request: NextRequest): Promise<DispatchTriggerResult> {
  const secret = process.env.N8N_DISPATCH_SECRET ?? process.env.CRON_JOB_SECRET;
  const normalizedSecret = secret?.trim();

  const headers: HeadersInit = {};
  if (normalizedSecret) {
    headers["x-n8n-secret"] = normalizedSecret;
  }

  try {
    const response = await fetch(new URL("/api/jobs/call-dispatch", request.url), {
      method: "POST",
      headers,
      cache: "no-store",
    });

    const text = await response.text();
    const parsed = text ? tryParseJson(text) : null;
    const parsedError =
      parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string" ? parsed.error : null;
    const parsedOk = parsed && typeof parsed === "object" && "ok" in parsed ? Boolean(parsed.ok) : response.ok;

    if (!response.ok || !parsedOk) {
      return {
        attempted: true,
        ok: false,
        status: response.status,
        error: parsedError ?? `Dispatch trigger failed with status ${response.status}`,
      };
    }

    return {
      attempted: true,
      ok: true,
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      attempted: true,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "Dispatch trigger request failed",
    };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    /* if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized webhook request" }, { status: 401 });
    } */

    const body = await request.json();
    const result = await processCallEndedEvent(body);
    const dispatch = await triggerNextCallDispatch(request);
    if (!dispatch.ok) {
      console.error("call-ended chained dispatch trigger failed", {
        dispatch,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Lead lifecycle processed",
        data: result,
        dispatch,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

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
    return errorResponse(error);
  }
}
