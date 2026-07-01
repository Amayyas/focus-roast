import type { ProviderConfig, ProviderId, TabInfo } from "../../types";
import { geminiProvider, GEMINI_DEFAULT_MODEL } from "./gemini";
import { openaiProvider, OPENAI_DEFAULT_BASE_URL, OPENAI_DEFAULT_MODEL } from "./openai";
import { AiClientError, type FocusResponse } from "./shared";
import type { AiProvider } from "./types";

const PROVIDERS: Record<ProviderId, AiProvider> = {
  gemini: geminiProvider,
  openai: openaiProvider,
};

/** Runs a focus analysis using the configured provider. */
export function analyzeFocus(tabs: TabInfo[], config: ProviderConfig): Promise<FocusResponse> {
  const provider = PROVIDERS[config.id];
  if (provider === undefined) {
    return Promise.reject(new AiClientError("Unknown AI provider configured."));
  }
  return provider.analyze(tabs, config);
}

export { AiClientError, type FocusResponse } from "./shared";

/** UI descriptor driving the setup screen for each provider. */
export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Hint about the expected API key format. */
  keyHint: string;
  keyPlaceholder: string;
  /** Whether the OpenAI-style base URL / model fields are shown. */
  showEndpointFields: boolean;
  defaultBaseUrl?: string;
  defaultModel: string;
  /** Where to obtain a key (omitted for self-hosted). */
  apiKeyUrl?: string;
}

export const PROVIDER_META: ProviderMeta[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyHint: "A Gemini key usually starts with “AIza”.",
    keyPlaceholder: "AIza...",
    showEndpointFields: false,
    defaultModel: GEMINI_DEFAULT_MODEL,
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openai",
    label: "OpenAI-compatible",
    keyHint:
      "Works with OpenAI, OpenRouter, Groq, Ollama… Set the base URL and model to match your provider.",
    keyPlaceholder: "sk-...",
    showEndpointFields: true,
    defaultBaseUrl: OPENAI_DEFAULT_BASE_URL,
    defaultModel: OPENAI_DEFAULT_MODEL,
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
];

/**
 * The origin a provider config will talk to, as a match pattern
 * (e.g. "https://api.openai.com/*"), or null if the URL is malformed.
 */
export function originPatternFor(config: ProviderConfig): string | null {
  try {
    const url =
      config.id === "gemini"
        ? "https://generativelanguage.googleapis.com"
        : config.baseUrl?.trim() || OPENAI_DEFAULT_BASE_URL;
    return `${new URL(url).origin}/*`;
  } catch {
    return null;
  }
}

/**
 * Ensures we hold host permission for the provider's endpoint, prompting the
 * user if needed. Gemini's origin is already granted via host_permissions, so
 * only custom OpenAI-compatible endpoints trigger a prompt. Must be called from
 * a user gesture (the Save click).
 */
export async function ensureHostPermission(config: ProviderConfig): Promise<boolean> {
  const pattern = originPatternFor(config);
  if (pattern === null) {
    return false;
  }
  if (await chrome.permissions.contains({ origins: [pattern] })) {
    return true;
  }
  return chrome.permissions.request({ origins: [pattern] });
}
