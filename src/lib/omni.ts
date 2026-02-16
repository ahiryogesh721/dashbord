type OmniDispatchInput = {
  toNumber: string;
  customerName?: string | null;
  leadId: string;
  followUpId: string;
};

type OmniDispatchResult = {
  requestId: string | null;
  raw: unknown;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function resolveDispatchUrl(): string {
  const directUrl = process.env.OMNI_URL?.trim();
  if (directUrl) return directUrl;

  const baseUrl = process.env.OMNI_BASE_URL?.trim();
  if (baseUrl) return `${baseUrl.replace(/\/$/, "")}/api/v1/calls/dispatch`;

  throw new Error("Missing required env var: OMNI_URL or OMNI_BASE_URL");
}

function resolveFromNumberId(): number {
  const rawFromNumberId = process.env.OMNI_FROM_NUMBER_ID?.trim();

  // Matches the working value from the provided n8n workflow when env var is not set.
  if (!rawFromNumberId) return 1720;

  const parsed = Number(rawFromNumberId);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new Error("OMNI_FROM_NUMBER_ID must be an integer");
  }

  return parsed;
}

export async function dispatchOmniCall(input: OmniDispatchInput): Promise<OmniDispatchResult> {
  const dispatchUrl = resolveDispatchUrl();
  const apiKey = getRequiredEnv("OMNI_API_KEY");
  const agentId = getRequiredEnv("OMNI_AGENT_ID");
  const fromNumberId = resolveFromNumberId();

  const response = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
      to_number: input.toNumber,
      from_number_id: fromNumberId,
      call_context: {
        name: input.customerName ?? "Lead",
        lead_id: input.leadId,
        follow_up_id: input.followUpId,
      },
    }),
  });

  const text = await response.text();
  const json = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new Error(`Omni dispatch failed (${response.status}): ${text}`);
  }

  const requestId =
    (json && typeof json === "object" && "request_id" in json && typeof json.request_id === "string"
      ? json.request_id
      : null) ?? null;

  return {
    requestId,
    raw: json ?? text,
  };
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}
