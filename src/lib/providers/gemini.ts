import { z } from "zod";
import type { ProviderConfig, TabInfo } from "../../types";
import type { AiProvider } from "./types";
import {
  AiClientError,
  buildUserMessage,
  messageForStatus,
  parseFocusResponse,
  SYSTEM_PROMPT,
  type FocusResponse,
} from "./shared";

const LABEL = "Gemini API";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
// Generous budget: "thinking" is disabled (thinkingBudget 0), but we keep
// headroom so the JSON is never truncated (finishReason MAX_TOKENS).
const MAX_TOKENS = 1024;

/**
 * Imposed output schema for Gemini (OpenAPI subset). Combined with
 * responseMimeType "application/json", it guarantees a structured JSON response.
 */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    score: { type: "INTEGER" },
    roast: { type: "STRING" },
    categories: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["score", "roast", "categories"],
  propertyOrdering: ["score", "roast", "categories"],
} as const;

const ResponsePayloadSchema = z.object({
  candidates: z
    .array(
      z.object({
        finishReason: z.string().optional(),
        content: z
          .object({
            parts: z.array(z.object({ text: z.string().optional() })).optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
});

/**
 * Calls the Gemini API to score focus from the tabs, then strictly validates
 * the response. The key goes through the x-goog-api-key header (not the URL,
 * to avoid it being logged).
 */
async function analyze(tabs: TabInfo[], config: ProviderConfig): Promise<FocusResponse> {
  const model = config.model?.trim() || GEMINI_DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": config.apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserMessage(tabs) }] }],
        generationConfig: {
          maxOutputTokens: MAX_TOKENS,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // gemini-2.5-flash enables "thinking" by default, which eats the token
          // budget before producing the JSON: we disable it.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch {
    throw new AiClientError("No connection to the Gemini API. Check your internet connection.");
  }

  if (!response.ok) {
    throw new AiClientError(messageForStatus(response.status, LABEL));
  }

  const payload = ResponsePayloadSchema.safeParse(await response.json().catch(() => null));
  if (!payload.success) {
    throw new AiClientError("Unexpected response from the Gemini API.");
  }

  const blockReason = payload.data.promptFeedback?.blockReason;
  if (blockReason !== undefined) {
    throw new AiClientError(`Request blocked by Gemini (reason: ${blockReason}).`);
  }

  const candidate = payload.data.candidates?.[0];
  const text = candidate?.content?.parts?.find((part) => part.text)?.text ?? "";
  if (text === "") {
    const reason = candidate?.finishReason;
    if (reason === "MAX_TOKENS") {
      throw new AiClientError("Response truncated by the token limit. Try again.");
    }
    if (reason === "SAFETY" || reason === "RECITATION") {
      throw new AiClientError(`Response filtered by Gemini (reason: ${reason}).`);
    }
    throw new AiClientError("The model returned no content.");
  }

  return parseFocusResponse(text);
}

export const geminiProvider: AiProvider = {
  id: "gemini",
  label: "Google Gemini",
  analyze,
};
