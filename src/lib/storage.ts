import type { FocusResult, ProviderConfig, StorageShape } from "../types";

const DEFAULTS: StorageShape = {
  provider: null,
  history: [],
  lastResult: null,
  lastError: null,
};

/**
 * Reads the entire persisted state, with default values. Transparently migrates
 * the legacy `apiKey` string (Gemini-only) to the new `provider` object.
 */
export async function getStorage(): Promise<StorageShape> {
  const data = (await chrome.storage.local.get({
    ...DEFAULTS,
    apiKey: "", // legacy field, kept only for migration
  })) as StorageShape & { apiKey?: string };

  let provider = data.provider;
  if (provider === null && (data.apiKey ?? "") !== "") {
    provider = { id: "gemini", apiKey: data.apiKey ?? "" };
    await chrome.storage.local.set({ provider });
    await chrome.storage.local.remove("apiKey");
  }

  return { provider, history: data.history, lastResult: data.lastResult, lastError: data.lastError };
}

export async function getProvider(): Promise<ProviderConfig | null> {
  const { provider } = await getStorage();
  return provider;
}

export async function setProvider(config: ProviderConfig): Promise<void> {
  await chrome.storage.local.set({ provider: { ...config, apiKey: config.apiKey.trim() } });
}

/** True if two timestamps fall on the same local calendar day. */
export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/**
 * Appends a result to the history. The history is reset every day:
 * only entries from the current day are kept (implicit reset at midnight).
 */
export async function appendResult(result: FocusResult): Promise<void> {
  const { history } = await getStorage();
  const todayHistory = history.filter((entry) => isSameDay(entry.timestamp, result.timestamp));
  todayHistory.push(result);

  await chrome.storage.local.set({
    history: todayHistory,
    lastResult: result,
    lastError: null,
  });
}

/** Stores an error message (without touching the last valid result). */
export async function setError(message: string): Promise<void> {
  await chrome.storage.local.set({ lastError: message });
}

/** Subscribes to local storage changes and returns an unsubscribe function. */
export function subscribe(callback: (storage: StorageShape) => void): () => void {
  const listener = (
    _changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== "local") {
      return;
    }
    void getStorage().then(callback);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
