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

export async function dispatchOmniCall(input: OmniDispatchInput): Promise<OmniDispatchResult> {
  const baseUrl = getRequiredEnv("OMNI_BASE_URL").replace(/\/$/, "");
  const apiKey = getRequiredEnv("OMNI_API_KEY");
  const agentId = getRequiredEnv("OMNI_AGENT_ID");
  const fromNumberIdRaw = getRequiredEnv("OMNI_FROM_NUMBER_ID");
  const fromNumberId = Number(fromNumberIdRaw);

  if (Number.isNaN(fromNumberId)) {
    throw new Error("OMNI_FROM_NUMBER_ID must be a number");
  }

  const response = await fetch(`${baseUrl}/api/v1/calls/dispatch`, {
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
