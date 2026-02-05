import { RssItem } from "./rss";

const positiveWords = [
  "beat",
  "boost",
  "bull",
  "optimistic",
  "surge",
  "record",
  "growth",
  "win",
  "approval",
  "progress",
  "rally",
  "deal",
  "advance",
  "upside"
];

const negativeWords = [
  "miss",
  "fall",
  "bear",
  "pessimistic",
  "decline",
  "loss",
  "crisis",
  "delay",
  "blocked",
  "risk",
  "downside",
  "collapse",
  "concern",
  "warning"
];

const stopWords = new Set([
  "will",
  "would",
  "should",
  "could",
  "with",
  "about",
  "that",
  "this",
  "they",
  "them",
  "from",
  "what",
  "when",
  "where",
  "which",
  "while",
  "into",
  "over",
  "under",
  "have",
  "has",
  "had",
  "are",
  "were",
  "who",
  "whom",
  "their",
  "there",
  "been",
  "after",
  "before"
]);

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));
}

export function analyzeSentiment(text: string) {
  const words = tokenize(text);
  if (!words.length) return 0;
  let score = 0;
  for (const word of words) {
    if (positiveWords.includes(word)) score += 1;
    if (negativeWords.includes(word)) score -= 1;
  }
  return score / Math.max(words.length, 1);
}

export function buildKeywords(question: string) {
  const words = tokenize(question);
  const unique = Array.from(new Set(words));
  return unique.slice(0, 6);
}

export function sentimentForMarket(question: string, items: RssItem[]) {
  const keywords = buildKeywords(question);
  let mentions = 0;
  let scoreTotal = 0;

  for (const item of items) {
    const text = `${item.title ?? ""} ${item.contentSnippet ?? ""} ${item.content ?? ""}`;
    const lower = text.toLowerCase();
    const hit = keywords.some((keyword) => lower.includes(keyword));
    if (hit) {
      mentions += 1;
      scoreTotal += analyzeSentiment(text);
    }
  }

  const score = mentions ? scoreTotal / mentions : 0;
  return { mentions, score, keywords };
}
