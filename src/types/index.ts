/**
 * Types shared between the service worker, the libraries and the popup UI.
 */

/** Data of a tab after cleaning (never the full URL, for privacy reasons). */
export interface TabInfo {
  title: string;
  domain: string;
}

/** Result of a focus analysis produced by the LLM, timestamped. */
export interface FocusResult {
  /** Smoothed score shown to the user (0-100). */
  score: number;
  /** Raw score returned by the LLM before smoothing (0-100). */
  rawScore: number;
  /** Blunt but good-natured comment. */
  roast: string;
  /** Detected activity categories (e.g. "work", "distraction"). */
  categories: string[];
  /** Epoch timestamp (ms) of the scan. */
  timestamp: number;
}

/** History for the current day. */
export type ScoreHistory = FocusResult[];

/** Shape persisted in chrome.storage.local. */
export interface StorageShape {
  apiKey: string;
  history: ScoreHistory;
  lastResult: FocusResult | null;
  lastError: string | null;
}

/** Messages sent from the popup to the service worker. */
export type RuntimeRequest = { type: "SCAN_NOW" };

/** Responses from the service worker to the popup. */
export type RuntimeResponse = { ok: true } | { ok: false; error: string };
