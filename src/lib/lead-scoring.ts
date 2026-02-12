import { InterestLabel } from "@/lib/domain";

export type LeadScoreResult = {
  score: number;
  interestLabel: InterestLabel;
  confidence: number;
  reason: string;
};

const POSITIVE_SIGNALS = [
  "visit",
  "schedule",
  "book",
  "interested",
  "buy",
  "purchase",
  "budget",
  "loan",
  "pre approved",
  "ready",
  "this week",
  "tomorrow",
];

const NEGATIVE_SIGNALS = [
  "not interested",
  "later",
  "maybe",
  "no budget",
  "wrong number",
  "just browsing",
  "call back next month",
  "not now",
];

function countSignals(text: string, signals: string[]): number {
  const normalized = text.toLowerCase();
  return signals.reduce((count, signal) => count + (normalized.includes(signal) ? 1 : 0), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function labelFromScore(score: number): InterestLabel {
  if (score >= 75) return "hot";
  if (score >= 45) return "warm";
  return "cold";
}

export function scoreLead({
  transcript,
  summary,
  goal,
  visitTime,
  duration,
}: {
  transcript?: string | null;
  summary?: string | null;
  goal?: string | null;
  visitTime?: string | null;
  duration?: number | null;
}): LeadScoreResult {
  const combinedText = [transcript, summary, goal].filter(Boolean).join(" ").trim();
  const reasons: string[] = [];
  let score = 25;

  if (visitTime && visitTime.trim()) {
    score += 25;
    reasons.push("visit time captured");
  }

  const positiveHits = countSignals(combinedText, POSITIVE_SIGNALS);
  const negativeHits = countSignals(combinedText, NEGATIVE_SIGNALS);

  if (positiveHits > 0) {
    score += Math.min(30, positiveHits * 6);
    reasons.push(`positive intent signals: ${positiveHits}`);
  }

  if (negativeHits > 0) {
    score -= Math.min(35, negativeHits * 8);
    reasons.push(`negative intent signals: ${negativeHits}`);
  }

  if (duration && duration >= 120) {
    score += 8;
    reasons.push("call duration above 2 minutes");
  }

  if (duration && duration >= 300) {
    score += 6;
    reasons.push("call duration above 5 minutes");
  }

  if (goal && goal.trim()) {
    score += 6;
    reasons.push("lead goal identified");
  }

  score = clamp(Math.round(score), 0, 100);

  const totalSignals =
    positiveHits + negativeHits + (visitTime && visitTime.trim() ? 1 : 0) + (goal && goal.trim() ? 1 : 0);
  const confidence = Number(clamp(0.45 + totalSignals * 0.07, 0.45, 0.95).toFixed(2));

  return {
    score,
    interestLabel: labelFromScore(score),
    confidence,
    reason: reasons.join("; ") || "insufficient behavioral signals",
  };
}
