import { z } from "zod";
import type { TabInfo } from "../../types";

/** Application error whose message is already readable by the end user. */
export class AiClientError extends Error {}

/**
 * Schema of the structured response expected from the LLM.
 * Any response that does not validate against this schema is rejected.
 */
export const FocusResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  roast: z.string().min(1).max(400),
  categories: z.array(z.string().min(1)).min(1).max(6),
});

export type FocusResponse = z.infer<typeof FocusResponseSchema>;

/**
 * Shared system prompt, provider-agnostic. The explicit JSON instruction also
 * satisfies OpenAI-compatible servers that require the word "json" when JSON
 * mode is enabled, and helps providers without native structured output.
 */
export const SYSTEM_PROMPT = `You are "Focus Roast", an attention coach with a blunt, funny tone — but ALWAYS good-natured.

You are given the list of tabs currently open in the browser (title + domain, never the full URL). You assess how focused the person seems on a coherent, productive activity, as opposed to being scattered or procrastinating.

Mandatory rules:
- "score": 0 = totally scattered or fully distracted, 100 = laser-focused on a single clear task.
- "roast": in English, funny and teasing, NEVER mean, humiliating or demoralizing. Maximum 280 characters. No insults, no judgement of the person's worth. Tease the activity, never the individual.
- "categories": 1 to 5 short keywords describing the detected activities (e.g. "work", "social media", "video", "shopping", "documentation", "messaging").

Respond ONLY with a JSON object of the form {"score": <integer 0-100>, "roast": "<text>", "categories": ["<keyword>", ...]} and nothing else.`;

/** Builds the user message listing the tabs (title — domain). */
export function buildUserMessage(tabs: TabInfo[]): string {
  const lines = tabs.map((tab) => `- ${tab.title} — ${tab.domain}`).join("\n");
  return `Here are the ${tabs.length} open tab(s):\n${lines}`;
}

/**
 * Extracts a JSON object from a text response, tolerating possible
 * markdown code blocks or stray text around the object.
 */
export function extractJson(text: string): unknown {
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

/** Parses + strictly validates a focus response from raw model text. */
export function parseFocusResponse(text: string): FocusResponse {
  const parsed = FocusResponseSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    throw new AiClientError("The model did not return a usable score.");
  }
  return parsed.data;
}

/** Maps an HTTP error status to a clear user-facing message. */
export function messageForStatus(status: number, label: string): string {
  switch (status) {
    case 400:
      return `Request rejected by the ${label} (the API key or model may be invalid).`;
    case 401:
    case 403:
      return `Invalid API key or missing access. Check your ${label} key in the settings.`;
    case 404:
      return `Endpoint or model not found on the ${label}. Check the base URL and model name.`;
    case 429:
      return "Too many requests (rate limit). Try again in a few minutes.";
    case 500:
    case 503:
      return `The ${label} is momentarily overloaded. Try again later.`;
    default:
      return `${label} error (HTTP ${status}).`;
  }
}
