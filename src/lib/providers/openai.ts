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

const LABEL = "API";
export const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";
export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1024;

const ResponsePayloadSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().optional() }).optional() }))
    .optional(),
});

/** Strips trailing slashes so we can safely append "/chat/completions". */
function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl?.trim() || OPENAI_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * Calls any OpenAI-compatible Chat Completions endpoint (OpenAI, OpenRouter,
 * Groq, DeepSeek, Mistral, Ollama, LM Studio…). JSON mode is requested when
 * supported; otherwise the shared prompt + parser still recover the JSON.
 */
async function analyze(tabs: TabInfo[], config: ProviderConfig): Promise<FocusResponse> {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const model = config.model?.trim() || OPENAI_DEFAULT_MODEL;

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(tabs) },
        ],
        response_format: { type: "json_object" },
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      }),
    });
  } catch {
    throw new AiClientError(
      "No connection to the API. Check your internet connection and the base URL.",
    );
  }

  if (!response.ok) {
    throw new AiClientError(messageForStatus(response.status, LABEL));
  }

  const payload = ResponsePayloadSchema.safeParse(await response.json().catch(() => null));
  if (!payload.success) {
    throw new AiClientError("Unexpected response from the API.");
  }

  const text = payload.data.choices?.[0]?.message?.content ?? "";
  if (text === "") {
    throw new AiClientError("The model returned no content.");
  }

  return parseFocusResponse(text);
}

export const openaiProvider: AiProvider = {
  id: "openai",
  label: "OpenAI-compatible",
  analyze,
};
