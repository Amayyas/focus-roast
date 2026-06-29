import type { TabInfo } from "../types";

/** Browser-internal URL schemes, never relevant to focus. */
const INTERNAL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "edge://",
  "brave://",
  "vivaldi://",
  "opera://",
  "devtools://",
  "view-source:",
];

/** A tab is relevant if it points to a real external web page. */
export function isRelevantTab(tab: chrome.tabs.Tab): boolean {
  const url = tab.url ?? tab.pendingUrl ?? "";
  if (url === "" || url === "about:blank") {
    return false;
  }
  return !INTERNAL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/** Extracts the "clean" domain (without www.) from a URL, or "" if unparsable. */
export function extractDomain(url: string): string {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Converts a Chrome tab into a cleaned TabInfo, or null if unusable. */
function toTabInfo(tab: chrome.tabs.Tab): TabInfo | null {
  const url = tab.url ?? tab.pendingUrl ?? "";
  const domain = extractDomain(url);
  if (domain === "") {
    return null;
  }
  const title = (tab.title ?? "").trim() || domain;
  return { title, domain };
}

/**
 * Collects all open tabs, filters out internal tabs,
 * and deduplicates identical entries (same title + same domain).
 * We never return the full URL: only title and domain are sent to the LLM.
 */
export async function collectTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({});
  const seen = new Set<string>();
  const result: TabInfo[] = [];

  for (const tab of tabs) {
    if (!isRelevantTab(tab)) {
      continue;
    }
    const info = toTabInfo(tab);
    if (info === null) {
      continue;
    }
    const key = `${info.domain}::${info.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(info);
  }

  return result;
}
