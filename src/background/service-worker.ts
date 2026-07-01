import { collectTabs } from "../lib/tabAnalyzer";
import { analyzeFocus, AiClientError } from "../lib/providers";
import { smoothScore } from "../lib/focusScore";
import { appendResult, getProvider, getStorage, setError } from "../lib/storage";
import type { FocusResult, RuntimeRequest, RuntimeResponse } from "../types";

const ALARM_NAME = "focus-scan";
const SCAN_PERIOD_MINUTES = 5;

/** Prevents two concurrent scans (alarm + manual scan at the same time). */
let scanInProgress = false;

/**
 * Runs a full scan: read tabs, call the AI, smooth, store.
 * All errors are caught and persisted (never a silent crash).
 */
async function runScan(): Promise<void> {
  if (scanInProgress) {
    return;
  }
  scanInProgress = true;
  try {
    const provider = await getProvider();
    if (provider === null) {
      // No provider configured: the popup will show the setup screen.
      return;
    }

    const tabs = await collectTabs();
    if (tabs.length === 0) {
      await setError("No relevant tab to analyze right now.");
      return;
    }

    const { history } = await getStorage();
    const ai = await analyzeFocus(tabs, provider);

    const result: FocusResult = {
      score: smoothScore(ai.score, history),
      rawScore: ai.score,
      roast: ai.roast,
      categories: ai.categories,
      timestamp: Date.now(),
    };

    await appendResult(result);
  } catch (error) {
    const message =
      error instanceof AiClientError ? error.message : "Unexpected error during the scan.";
    await setError(message);
  } finally {
    scanInProgress = false;
  }
}

// Creates (or resets) the periodic alarm on install and on startup.
function ensureAlarm(): void {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: SCAN_PERIOD_MINUTES,
    delayInMinutes: 1,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarm();
});

// We use chrome.alarms (not setInterval) because the MV3 service worker
// is put to sleep: setInterval would not survive, but the alarm does.
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    void runScan();
  }
});

// Manual scan triggered from the popup.
chrome.runtime.onMessage.addListener(
  (message: RuntimeRequest, _sender, sendResponse: (response: RuntimeResponse) => void) => {
    if (message.type === "SCAN_NOW") {
      runScan()
        .then(() => sendResponse({ ok: true }))
        .catch((error: unknown) =>
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : "Scan failed.",
          }),
        );
      // true => asynchronous response.
      return true;
    }
    return undefined;
  },
);
