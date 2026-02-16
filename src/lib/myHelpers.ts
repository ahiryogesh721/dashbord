type ResponsesContentItem = {
  text?: unknown;
};

type ResponsesOutputItem = {
  content?: unknown;
};

function extractResponsesText(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const withOutputText = data as { output_text?: unknown };
  if (typeof withOutputText.output_text === "string" && withOutputText.output_text.trim()) {
    return withOutputText.output_text.trim();
  }

  const withOutput = data as { output?: unknown };
  if (!Array.isArray(withOutput.output)) return null;

  const textParts: string[] = [];
  for (const item of withOutput.output as ResponsesOutputItem[]) {
    if (!item || typeof item !== "object") continue;
    const content = item.content;
    if (!Array.isArray(content)) continue;

    for (const contentItem of content as ResponsesContentItem[]) {
      if (!contentItem || typeof contentItem !== "object") continue;
      if (typeof contentItem.text === "string" && contentItem.text.trim()) {
        textParts.push(contentItem.text.trim());
      }
    }
  }

  const combined = textParts.join(" ").trim();
  return combined || null;
}

export async function translateHindiToEnglish(hindiText: string): Promise<string> {
  if (typeof hindiText !== "string" || !hindiText.trim()) {
    throw new Error("Invalid Hindi text input");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required env var: OPENAI_API_KEY");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: `Translate the following Hindi text into natural English. Only return the translated English sentence.\n\nHindi: ${hindiText.trim()}`,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Translation request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Translation API error: ${err}`);
  }

  const data = (await response.json()) as unknown;
  const translated = extractResponsesText(data);
  if (!translated) {
    throw new Error("Translation API error: missing text output");
  }

  return translated;
}

export function containsHindi(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  // Unicode range for Devanagari (Hindi script)
  const hindiRegex = /[\u0900-\u097F]/;

  return hindiRegex.test(text);
}

