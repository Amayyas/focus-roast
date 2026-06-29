import { z } from "zod";
import type { TabInfo } from "../types";

const MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
// Generous budget: "thinking" is disabled (thinkingBudget 0), but we keep
// headroom so the JSON is never truncated (finishReason MAX_TOKENS).
const MAX_TOKENS = 1024;

/**
 * Schema of the structured response expected from the LLM.
 * Any response that does not validate against this schema is rejected (see analyzeFocus).
 */
const FocusResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  roast: z.string().min(1).max(400),
  categories: z.array(z.string().min(1)).min(1).max(6),
});

export type FocusResponse = z.infer<typeof FocusResponseSchema>;

/** Application error whose message is already readable by the end user. */
export class AiClientError extends Error {}

const SYSTEM_PROMPT = `You are "Focus Roast", an attention coach with a blunt, funny tone — but ALWAYS good-natured.

You are given the list of tabs currently open in the browser (title + domain, never the full URL). You assess how focused the person seems on a coherent, productive activity, as opposed to being scattered or procrastinating.

Mandatory rules:
- "score": 0 = totally scattered or fully distracted, 100 = laser-focused on a single clear task.
- "roast": in English, funny and teasing, NEVER mean, humiliating or demoralizing. Maximum 280 characters. No insults, no judgement of the person's worth. Tease the activity, never the individual.
- "categories": 1 to 5 short keywords describing the detected activities (e.g. "work", "social media", "video", "shopping", "documentation", "messaging").`;

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

/** Builds the user message listing the tabs (title — domain). */
function buildUserMessage(tabs: TabInfo[]): string {
  const lines = tabs.map((tab) => `- ${tab.title} — ${tab.domain}`).join("\n");
  return `Here are the ${tabs.length} open tab(s):\n${lines}`;
}

/**
 * Extracts a JSON object from a text response, tolerating possible
 * markdown code blocks or stray text around the object.
 */
function extractJson(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new AiClientError("Model response is unreadable (no JSON found).");
  }
  try {
    return JSON.parse(fenced.slice(start, end + 1));
  } catch {
    throw new AiClientError("Model response is unreadable (invalid JSON).");
  }
}

/** Maps an HTTP error status to a clear user-facing message. */
function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Request rejected by the Gemini API (API key may be invalid).";
    case 401:
    case 403:
      return "Invalid API key or missing access. Check your Gemini key in the settings.";
    case 429:
      return "Too many requests (rate limit). Try again in a few minutes.";
    case 500:
    case 503:
      return "The Gemini API is momentarily overloaded. Try again later.";
    default:
      return `Gemini API error (HTTP ${status}).`;
  }
}

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
 * Calls the Gemini API to score focus from the tabs,
 * then strictly validates the response via Zod.
 *
 * Called from the service worker. We use fetch directly: the Gemini API
 * accepts browser calls (CORS), and the key goes through the x-goog-api-key
 * header (not in the URL, to avoid it being logged).
 */
export async function analyzeFocus(tabs: TabInfo[], apiKey: string): Promise<FocusResponse> {
  let response: Response;
  try {
    response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
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
    throw new AiClientError(messageForStatus(response.status));
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

  const parsed = FocusResponseSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new AiClientError("The model did not return a usable score.");
  }

  return parsed.data;
}
