export async function translateHindiToEnglish(hindiText: string): Promise<string> {
  if (!hindiText || typeof hindiText !== "string") {
    throw new Error("Invalid Hindi text input");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: `Translate the following Hindi text into natural English. Only return the translated English sentence.\n\nHindi: ${hindiText}`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Translation API error: ${err}`);
  }

  const data = await response.json();

  return data.output[0].content[0].text.trim();
}

export function containsHindi(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  // Unicode range for Devanagari (Hindi script)
  const hindiRegex = /[\u0900-\u097F]/;

  return hindiRegex.test(text);
}

