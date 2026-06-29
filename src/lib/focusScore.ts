import type { ScoreHistory } from "../types";

/** Size of the moving-average window (results taken into account, including the current one). */
const SMOOTHING_WINDOW = 3;

/**
 * Smooths a raw score via a moving average using the latest raw scores
 * from history, to avoid abrupt jumps from one scan to the next.
 */
export function smoothScore(rawScore: number, history: ScoreHistory): number {
  const previousRaw = history.slice(-(SMOOTHING_WINDOW - 1)).map((r) => r.rawScore);
  const window = [...previousRaw, rawScore];
  const average = window.reduce((sum, value) => sum + value, 0) / window.length;
  return Math.round(clamp(average, 0, 100));
}

export type ScoreTier = "low" | "medium" | "high";

/** Categorizes a score for the UI color code. */
export function scoreTier(score: number): ScoreTier {
  if (score < 40) {
    return "low";
  }
  if (score < 70) {
    return "medium";
  }
  return "high";
}

/** Color associated with a tier (red / yellow / green). */
export function tierColor(tier: ScoreTier): string {
  switch (tier) {
    case "low":
      return "#ef4444";
    case "medium":
      return "#f59e0b";
    case "high":
      return "#22c55e";
  }
}

export interface ScoreBucket {
  /** Human-readable label (e.g. "14:30"). */
  label: string;
  /** Average score over the bucket. */
  score: number;
}

/**
 * Aggregates history into time buckets (30 min by default) by averaging
 * the scores, for a readable daily history chart.
 */
export function buildBuckets(history: ScoreHistory, bucketMinutes = 30): ScoreBucket[] {
  if (history.length === 0) {
    return [];
  }

  const bucketMs = bucketMinutes * 60 * 1000;
  const groups = new Map<number, number[]>();

  for (const result of history) {
    const bucketStart = Math.floor(result.timestamp / bucketMs) * bucketMs;
    const scores = groups.get(bucketStart) ?? [];
    scores.push(result.score);
    groups.set(bucketStart, scores);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketStart, scores]) => ({
      label: formatTime(bucketStart),
      score: Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length),
    }));
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
