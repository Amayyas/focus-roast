import type { FocusResult, StorageShape } from "../types";

const DEFAULTS: StorageShape = {
  apiKey: "",
  history: [],
  lastResult: null,
  lastError: null,
};

/** Reads the entire persisted state, with default values. */
export async function getStorage(): Promise<StorageShape> {
  const data = await chrome.storage.local.get(DEFAULTS);
  return data as StorageShape;
}

export async function getApiKey(): Promise<string> {
  const { apiKey } = await chrome.storage.local.get({ apiKey: DEFAULTS.apiKey });
  return apiKey as string;
}

export async function setApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ apiKey: apiKey.trim() });
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
